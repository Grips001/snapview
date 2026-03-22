import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import { checkMacOSPermission, captureRegion, getScreenSources, getActiveDisplay } from './capture';
import { sweepOldCaptures } from './cleanup';
import { IPC_CHANNELS } from '../shared/types';

// ─── Auto-trigger confirmation config ───────────────────────────────────────
const CONFIG_DIR = path.join(os.homedir(), '.snapview');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

async function readConfig(): Promise<Record<string, unknown>> {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writeConfig(config: Record<string, unknown>): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
}

/**
 * Show a native confirmation dialog the first time Claude auto-triggers a capture.
 * Returns true if the user approves (or has previously approved), false if denied.
 */
async function checkAutoTriggerApproval(): Promise<boolean> {
  const config = await readConfig();
  if (config.autoTriggerApproved === true) return true;

  const { response } = await dialog.showMessageBox({
    type: 'question',
    title: 'Snapview',
    message: 'Claude is requesting to see your screen',
    detail:
      'Claude Code has triggered a screen capture to better understand what you\'re looking at. ' +
      'This will open a transparent overlay where you choose exactly which region to share.\n\n' +
      'Allow Claude to request screen captures in the future?',
    buttons: ['Allow', 'Deny'],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });

  if (response === 0) {
    config.autoTriggerApproved = true;
    try {
      await writeConfig(config);
    } catch {
      // Config write failure shouldn't block the capture — approval still valid for this session
      console.error('[snapview] Could not persist auto-trigger approval to', CONFIG_FILE);
    }
    return true;
  }
  return false;
}

// ─── Linux GPU flags (PLAT-02) ──────────────────────────────────────────────
// Must be applied BEFORE app.whenReady() — sets Chromium command-line switches
// Required for transparent BrowserWindow on X11 with NVIDIA drivers
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-transparent-visuals');
  app.commandLine.appendSwitch('disable-gpu');
}

// ─── Unhandled rejection handler ────────────────────────────────────────────
// Async code (captureRegion, config I/O, etc.) could reject unexpectedly.
// Node 24 throws on unhandled rejections by default; this gives us control
// over the error message and exit code.
process.on('unhandledRejection', (reason) => {
  console.error('[snapview] Unhandled rejection:', reason);
  app.exit(1);
});

// ─── Wayland uncaughtException handler (PLAT-06) ────────────────────────────
// XDP portal dismissal on Wayland can throw an uncaught exception
process.on('uncaughtException', (err) => {
  const isWayland = process.platform === 'linux' && (process.env.XDG_SESSION_TYPE === 'wayland' || process.env.WAYLAND_DISPLAY);
  if (isWayland) {
    console.error(`[snapview] Screen capture failed on Wayland: ${err.message}`);
    console.error('[snapview] Try running on X11 or with XDG_SESSION_TYPE=x11 for better compatibility.');
  } else {
    console.error(`[snapview] Unexpected error: ${err.message}`);
  }
  app.exit(1);
});

// ─── Hard-exit timeout (PLAT-03) ────────────────────────────────────────────
// Prevents the Electron process from hanging indefinitely (e.g. during Phase 2 hook).
// Set BEFORE any UI creation. Cleared when capture completes or user cancels cleanly.
const HARD_EXIT_TIMEOUT_MS = 30_000;
const hardExitTimer = setTimeout(() => {
  console.error('[snapview] Hard exit timeout reached — forcing quit');
  app.exit(1);
}, HARD_EXIT_TIMEOUT_MS);
hardExitTimer.unref(); // Don't keep the process alive for this timer alone

// Ensure timer is cleared on all quit paths (not just IPC handlers)
app.on('will-quit', () => clearTimeout(hardExitTimer));

// ─── createOverlay ──────────────────────────────────────────────────────────
/**
 * Create the overlay BrowserWindow on the monitor where the cursor currently is.
 * Uses explicit x/y/width/height bounds instead of fullscreen:true so that
 * the overlay lands on the correct monitor in multi-monitor setups (PLAT-04).
 */
function createOverlay(): BrowserWindow {
  const activeDisplay = getActiveDisplay();
  const { x, y, width, height } = activeDisplay.bounds;

  const overlay = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    transparent: true,
    fullscreen: false, // CRITICAL: fullscreen:true ignores x/y and uses primary display
    skipTaskbar: true,
    hasShadow: false, // Clean transparent overlay, especially on Linux Wayland
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox defaults to true since Electron 20 — preload only uses
      // contextBridge and ipcRenderer, both of which work in sandbox mode
      navigateOnDragDrop: false,
    },
  });

  // 'screen-saver' level places the window above the taskbar on Windows.
  // Default 'floating' level gets pushed above taskbar, shrinking content area.
  overlay.setAlwaysOnTop(true, 'screen-saver');

  // Force exact display bounds — OS may constrain initial window placement
  overlay.setBounds({ x, y, width, height });

  // Security: block unexpected navigation and window creation
  overlay.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  overlay.webContents.on('will-navigate', (event) => { event.preventDefault(); });

  overlay.loadFile(path.join(__dirname, '../renderer/index.html'));
  return overlay;
}

// ─── IPC handlers ───────────────────────────────────────────────────────────

/**
 * capture:get-sources
 * Returns screen sources for the renderer to use as the overlay background.
 * Checks macOS permission first; returns { permissionDenied: true } if denied.
 */
ipcMain.handle(IPC_CHANNELS.GET_SOURCES, async () => {
  const permission = await checkMacOSPermission();
  if (permission === 'denied') {
    return { permissionDenied: true };
  }
  return getScreenSources();
});

/**
 * capture:region
 * Captures the selected region, writes PNG, emits file path to stdout, then quits.
 * Exit code 0 = success (file path on stdout).
 */
ipcMain.handle(IPC_CHANNELS.CAPTURE_REGION, async (_event, rect) => {
  try {
    const result = await captureRegion(rect);
    // Emit the file path to stdout — consumed by the CLI entry point (bin/snapview.cjs)
    process.stdout.write(result.filePath + '\n');
    process.exitCode = 0;
    app.quit();
    return result;
  } catch (err) {
    console.error('[snapview] captureRegion failed:', (err as Error).message);
    process.exitCode = 1;
    app.quit();
    return null;
  }
});

/**
 * capture:cancel
 * User cancelled (ESC or explicit cancel). No stdout output.
 * Exit code 2 = cancelled by user (distinguishable from error in Phase 2 hooks).
 */
ipcMain.handle(IPC_CHANNELS.CANCEL, () => {
  process.exitCode = 2;
  app.quit();
});

// ─── App lifecycle ───────────────────────────────────────────────────────────

const isAutoTriggered = process.argv.includes('--auto-trigger');

app.whenReady().then(async () => {
  // Fire-and-forget — background sweep of old screenshots (>24h)
  sweepOldCaptures();

  // If launched by auto-trigger, confirm with user on first use
  if (isAutoTriggered) {
    const approved = await checkAutoTriggerApproval();
    if (!approved) {
      clearTimeout(hardExitTimer);
      // Use app.exit() instead of app.quit() — no windows exist yet, and app.quit()
      // can leave orphaned processes on Windows when no windows are open (electron#2312)
      app.exit(2); // Exit code 2 = user cancel
      return;
    }
  }

  createOverlay();
});

// Prevents orphaned Electron process if all windows are closed via OS controls (PLAT-03)
app.on('window-all-closed', () => {
  app.quit();
});
