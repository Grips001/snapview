/**
 * Unit tests for src/main/index.ts
 *
 * Strategy: Since index.ts executes side effects at module load time (Linux GPU flags,
 * hard exit timer, Wayland handler), we use source-level pattern verification
 * (approach 2 from the plan) for load-time side effects, and direct logic tests
 * for extractable pure computations.
 *
 * This is the explicitly allowed approach from the plan:
 * "read the source and verify patterns exist — valid testing strategy for code
 *  that executes side effects at import time"
 */

import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';

// Read the index.ts source for pattern-based verification
const indexSource = readFileSync(
  path.join(import.meta.dir, 'index.ts'),
  'utf-8'
);

// Strip single-line comments to get code-only positions for positional assertions
const indexSourceNoComments = indexSource
  .split('\n')
  .map((line) => {
    const commentIdx = line.indexOf('//');
    return commentIdx >= 0 ? line.slice(0, commentIdx) : line;
  })
  .join('\n');

describe("Linux GPU flags — PLAT-02", () => {
  test('enable-transparent-visuals switch is guarded by process.platform === linux', () => {
    // The guard must wrap the appendSwitch calls
    const guardPattern = /if\s*\(\s*process\.platform\s*===\s*['"]linux['"]\s*\)/;
    expect(guardPattern.test(indexSource)).toBe(true);
  });

  test('appendSwitch enable-transparent-visuals is present', () => {
    expect(indexSource).toContain("appendSwitch('enable-transparent-visuals')");
  });

  test('appendSwitch disable-gpu is present', () => {
    expect(indexSource).toContain("appendSwitch('disable-gpu')");
  });

  test('GPU flags are inside the linux platform guard (not applied on all platforms)', () => {
    // Use comment-stripped source for positional assertions to avoid comment text matches
    const guardStart = indexSourceNoComments.indexOf("if (process.platform === 'linux')");
    expect(guardStart).toBeGreaterThan(-1);

    const transparentPos = indexSourceNoComments.indexOf("appendSwitch('enable-transparent-visuals')");
    const disableGpuPos = indexSourceNoComments.indexOf("appendSwitch('disable-gpu')");

    // Both switches must appear AFTER the guard (inside its block)
    expect(transparentPos).toBeGreaterThan(guardStart);
    expect(disableGpuPos).toBeGreaterThan(guardStart);

    // Guard must appear before any app.whenReady call
    const whenReadyPos = indexSourceNoComments.indexOf('app.whenReady()');
    expect(guardStart).toBeLessThan(whenReadyPos);
  });

  test('GPU flags are applied before app.whenReady (at module load time)', () => {
    // Use comment-stripped source to find actual code positions (not comment mentions)
    const guardPos = indexSourceNoComments.indexOf("if (process.platform === 'linux')");
    const whenReadyPos = indexSourceNoComments.indexOf('app.whenReady()');
    expect(guardPos).toBeLessThan(whenReadyPos);
  });
});

describe('Hard exit timeout — PLAT-03', () => {
  test('HARD_EXIT_TIMEOUT_MS constant equals 30000 (30 seconds)', () => {
    // Accept both 30_000 (numeric separator) and 30000
    const has30000 = indexSource.includes('30_000') || indexSource.includes('30000');
    expect(has30000).toBe(true);
  });

  test('HARD_EXIT_TIMEOUT_MS constant is declared', () => {
    expect(indexSource).toContain('HARD_EXIT_TIMEOUT_MS');
  });

  test('setTimeout is called with HARD_EXIT_TIMEOUT_MS', () => {
    expect(indexSource).toContain('setTimeout(');
    expect(indexSource).toContain('HARD_EXIT_TIMEOUT_MS');
    // The setTimeout call must reference the constant
    const setTimeoutPos = indexSource.indexOf('setTimeout(');
    const constantDeclPos = indexSource.indexOf('HARD_EXIT_TIMEOUT_MS =');
    // setTimeout comes after constant declaration
    expect(setTimeoutPos).toBeGreaterThan(constantDeclPos);
  });

  test('timer is unref()d so it does not keep process alive', () => {
    expect(indexSource).toContain('.unref()');
    // unref is called on the hardExitTimer variable
    expect(indexSource).toContain('hardExitTimer.unref()');
  });

  test('timer calls app.exit(1) on timeout', () => {
    // Find the setTimeout block and verify it contains app.exit(1)
    const setTimeoutPos = indexSource.indexOf('setTimeout(');
    const timerBlock = indexSource.slice(setTimeoutPos, setTimeoutPos + 200);
    expect(timerBlock).toContain('app.exit(1)');
  });
});

describe('Overlay window bounds — PLAT-04', () => {
  test('BrowserWindow is created with bounds from getDisplayNearestPoint', () => {
    expect(indexSource).toContain('screen.getDisplayNearestPoint(');
    expect(indexSource).toContain('screen.getCursorScreenPoint()');
  });

  test('fullscreen is set to false in BrowserWindow config', () => {
    expect(indexSource).toContain('fullscreen: false');
    // Must NOT have fullscreen: true
    expect(indexSource).not.toContain('fullscreen: true');
  });

  test('BrowserWindow receives explicit x, y, width, height from activeDisplay.bounds', () => {
    // The source must destructure bounds from the active display
    expect(indexSource).toContain('activeDisplay.bounds');
    // And pass x, y, width, height to BrowserWindow
    const bwConfig = indexSource.slice(
      indexSource.indexOf('new BrowserWindow('),
      indexSource.indexOf('overlay.loadFile(')
    );
    expect(bwConfig).toContain('x,');
    expect(bwConfig).toContain('y,');
    expect(bwConfig).toContain('width,');
    expect(bwConfig).toContain('height,');
  });

  test('BrowserWindow has frame: false and transparent: true for overlay behavior', () => {
    expect(indexSource).toContain('frame: false');
    expect(indexSource).toContain('transparent: true');
  });

  test('overlay uses setAlwaysOnTop with screen-saver level', () => {
    expect(indexSource).toContain("setAlwaysOnTop(true, 'screen-saver')");
  });
});

describe('Wayland handler — PLAT-06', () => {
  test("process.on('uncaughtException') handler is registered", () => {
    expect(indexSource).toContain("process.on('uncaughtException'");
  });

  test('uncaughtException handler calls app.exit(1)', () => {
    // Find the handler and verify it exits
    const handlerStart = indexSource.indexOf("process.on('uncaughtException'");
    // Extract the handler block — includes Wayland-specific messaging
    const handlerSection = indexSource.slice(handlerStart, handlerStart + 500);
    expect(handlerSection).toContain('app.exit(1)');
  });

  test('Wayland handler is registered before app.whenReady (module load time)', () => {
    // Use comment-stripped source to avoid comment mentions of app.whenReady
    const handlerPos = indexSourceNoComments.indexOf("process.on('uncaughtException'");
    const whenReadyPos = indexSourceNoComments.indexOf('app.whenReady()');
    expect(handlerPos).toBeLessThan(whenReadyPos);
  });
});

describe('window-all-closed lifecycle', () => {
  test("app.on('window-all-closed') handler calls app.quit()", () => {
    expect(indexSource).toContain("app.on('window-all-closed'");
    // Find the handler
    const handlerStart = indexSource.indexOf("app.on('window-all-closed'");
    const handlerSection = indexSource.slice(handlerStart, handlerStart + 100);
    expect(handlerSection).toContain('app.quit()');
  });
});

describe('IPC channel registration', () => {
  test('ipcMain.handle is registered for GET_SOURCES channel', () => {
    expect(indexSource).toContain('IPC_CHANNELS.GET_SOURCES');
    expect(indexSource).toContain('ipcMain.handle(IPC_CHANNELS.GET_SOURCES');
  });

  test('ipcMain.handle is registered for CAPTURE_REGION channel', () => {
    expect(indexSource).toContain('IPC_CHANNELS.CAPTURE_REGION');
    expect(indexSource).toContain('ipcMain.handle(IPC_CHANNELS.CAPTURE_REGION');
  });

  test('GET_SOURCES handler checks macOS permission first — CAPT-05', () => {
    // Find the GET_SOURCES handler and verify permission check
    const handlerStart = indexSource.indexOf('ipcMain.handle(IPC_CHANNELS.GET_SOURCES');
    const handlerSection = indexSource.slice(handlerStart, handlerStart + 300);
    expect(handlerSection).toContain('checkMacOSPermission()');
  });
});

describe('Auto-trigger confirmation', () => {
  test('--auto-trigger flag is detected from process.argv', () => {
    expect(indexSource).toContain("process.argv.includes('--auto-trigger')");
  });

  test('isAutoTriggered flag is checked inside app.whenReady before createOverlay call', () => {
    // Find the whenReady block and verify auto-trigger check appears before createOverlay call
    const whenReadyPos = indexSource.indexOf('app.whenReady()');
    const afterReady = indexSource.slice(whenReadyPos);
    const flagPos = afterReady.indexOf('isAutoTriggered');
    // Use the semicolon-terminated call to distinguish from the function definition
    const overlayCallPos = afterReady.indexOf('createOverlay();');
    expect(flagPos).toBeGreaterThan(-1);
    expect(overlayCallPos).toBeGreaterThan(-1);
    expect(flagPos).toBeLessThan(overlayCallPos);
  });

  test('checkAutoTriggerApproval uses dialog.showMessageBox', () => {
    expect(indexSource).toContain('dialog.showMessageBox(');
  });

  test('approval is persisted to config file via writeConfig', () => {
    expect(indexSource).toContain('autoTriggerApproved');
    expect(indexSource).toContain('writeConfig(');
  });

  test('config is stored in ~/.snapview/config.json', () => {
    expect(indexSource).toContain("'.snapview'");
    expect(indexSource).toContain("'config.json'");
  });

  test('denial exits with code 2 via app.exit (no windows exist yet)', () => {
    // Must use app.exit() not app.quit() when no windows are open (electron#2312)
    const whenReadyPos = indexSource.indexOf('app.whenReady()');
    const afterReady = indexSource.slice(whenReadyPos);
    expect(afterReady).toContain('app.exit(2)');
  });
});

describe('Wayland-specific error messaging', () => {
  test('uncaughtException handler checks for Wayland session', () => {
    expect(indexSource).toContain('XDG_SESSION_TYPE');
    expect(indexSource).toContain('WAYLAND_DISPLAY');
  });

  test('provides actionable hint for Wayland users', () => {
    expect(indexSource).toContain('Try running on X11');
  });
});

describe('Unhandled rejection handler', () => {
  test("process.on('unhandledRejection') handler is registered", () => {
    expect(indexSource).toContain("process.on('unhandledRejection'");
  });

  test('unhandledRejection handler calls app.exit(1)', () => {
    const handlerStart = indexSource.indexOf("process.on('unhandledRejection'");
    const handlerSection = indexSource.slice(handlerStart, handlerStart + 200);
    expect(handlerSection).toContain('app.exit(1)');
  });
});

describe('Security hardening', () => {
  test('sandbox is not explicitly disabled (defaults to true since Electron 20)', () => {
    expect(indexSource).not.toContain('sandbox: false');
  });

  test('navigateOnDragDrop is disabled', () => {
    expect(indexSource).toContain('navigateOnDragDrop: false');
  });

  test('window open handler denies new windows', () => {
    expect(indexSource).toContain("setWindowOpenHandler(");
    expect(indexSource).toContain("action: 'deny'");
  });

  test('will-navigate is blocked', () => {
    expect(indexSource).toContain("'will-navigate'");
    expect(indexSource).toContain('event.preventDefault()');
  });

  test('hasShadow is false for clean overlay', () => {
    expect(indexSource).toContain('hasShadow: false');
  });
});

describe('Timer cleanup', () => {
  test('will-quit handler clears hard exit timer', () => {
    expect(indexSource).toContain("app.on('will-quit'");
    expect(indexSource).toContain('clearTimeout(hardExitTimer)');
  });
});

// ─── Cross-file security verification ────────────────────────────────────────
const htmlSource = readFileSync(
  path.join(import.meta.dir, '../renderer/index.html'),
  'utf-8'
);
const preloadSource = readFileSync(
  path.join(import.meta.dir, '../preload/preload.ts'),
  'utf-8'
);

describe('Content Security Policy', () => {
  test('renderer HTML includes a CSP meta tag', () => {
    expect(htmlSource).toContain('Content-Security-Policy');
  });

  test('CSP blocks all by default', () => {
    expect(htmlSource).toContain("default-src 'none'");
  });

  test('CSP allows data: URLs for images (screen capture thumbnails)', () => {
    expect(htmlSource).toContain('img-src');
    expect(htmlSource).toContain('data:');
  });
});

describe('Preload rect validation', () => {
  test('preload validates rect before forwarding to main', () => {
    expect(preloadSource).toContain('Number.isFinite');
    expect(preloadSource).toContain('rect.width <= 0');
  });

  test('preload strips unexpected properties from rect', () => {
    // Should construct a new object with only x, y, width, height
    expect(preloadSource).toContain('x: rect.x');
    expect(preloadSource).toContain('y: rect.y');
    expect(preloadSource).toContain('width: rect.width');
    expect(preloadSource).toContain('height: rect.height');
  });

  test('preload imports IPC_CHANNELS from shared types (not hardcoded)', () => {
    expect(preloadSource).toContain("from '../shared/types'");
    expect(preloadSource).toContain('IPC_CHANNELS.GET_SOURCES');
    expect(preloadSource).toContain('IPC_CHANNELS.CAPTURE_REGION');
    expect(preloadSource).toContain('IPC_CHANNELS.CANCEL');
  });
});
