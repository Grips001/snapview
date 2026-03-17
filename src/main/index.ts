import { app, BrowserWindow, ipcMain, screen } from 'electron';
import path from 'path';
import { checkMacOSPermission, captureRegion, getScreenSources } from './capture';
import { sweepOldCaptures } from './cleanup';
import { IPC_CHANNELS } from '../shared/types';

// ─── Linux GPU flags (PLAT-02) ──────────────────────────────────────────────
// Must be applied BEFORE app.whenReady() — sets Chromium command-line switches
// Required for transparent BrowserWindow on X11 with NVIDIA drivers
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-transparent-visuals');
  app.commandLine.appendSwitch('disable-gpu');
}

// ─── Wayland uncaughtException handler (PLAT-06) ────────────────────────────
// XDP portal dismissal on Wayland can throw an uncaught exception
process.on('uncaughtException', (err) => {
  console.error('[snapview] Uncaught exception:', err.message);
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

// ─── createOverlay ──────────────────────────────────────────────────────────
/**
 * Create the overlay BrowserWindow on the monitor where the cursor currently is.
 * Uses explicit x/y/width/height bounds instead of fullscreen:true so that
 * the overlay lands on the correct monitor in multi-monitor setups (PLAT-04).
 */
function createOverlay(): BrowserWindow {
  const cursorPos = screen.getCursorScreenPoint();
  const activeDisplay = screen.getDisplayNearestPoint(cursorPos);
  const { x, y, width, height } = activeDisplay.bounds;

  const overlay = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    fullscreen: false, // CRITICAL: fullscreen:true ignores x/y and uses primary display
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for preload IPC — sandbox:true blocks ipcRenderer
    },
  });

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
    clearTimeout(hardExitTimer);
    process.exitCode = 0;
    app.quit();
    return result;
  } catch (err) {
    console.error('[snapview] captureRegion failed:', (err as Error).message);
    clearTimeout(hardExitTimer);
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
  clearTimeout(hardExitTimer);
  process.exitCode = 2;
  app.quit();
});

// ─── App lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Fire-and-forget — background sweep of old screenshots (>24h)
  sweepOldCaptures();

  createOverlay();
});

// Prevents orphaned Electron process if all windows are closed via OS controls (PLAT-03)
app.on('window-all-closed', () => {
  app.quit();
});
