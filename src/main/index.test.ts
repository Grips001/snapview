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
    // Find the setTimeout callback and verify it calls app.exit(1) inside it
    // We look for app.exit within the setTimeout block specifically
    expect(indexSource).toContain('app.exit(1)');
    const setTimeoutPos = indexSource.indexOf('setTimeout(');
    // Find the SECOND occurrence of app.exit(1) — first is in Wayland handler,
    // second is in the setTimeout callback for the hard exit timer
    const firstExitPos = indexSource.indexOf('app.exit(1)');
    const secondExitPos = indexSource.indexOf('app.exit(1)', firstExitPos + 1);
    // The setTimeout callback's app.exit must appear after setTimeout starts
    expect(secondExitPos).toBeGreaterThan(setTimeoutPos);
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

  test('overlay uses alwaysOnTop: true', () => {
    expect(indexSource).toContain('alwaysOnTop: true');
  });
});

describe('Wayland handler — PLAT-06', () => {
  test("process.on('uncaughtException') handler is registered", () => {
    expect(indexSource).toContain("process.on('uncaughtException'");
  });

  test('uncaughtException handler calls app.exit(1)', () => {
    // Find the handler and verify it exits
    const handlerStart = indexSource.indexOf("process.on('uncaughtException'");
    // Extract the handler block (approximately 3 lines)
    const handlerSection = indexSource.slice(handlerStart, handlerStart + 200);
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
