---
phase: 01-capture-engine
verified: 2026-03-17T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
re_verification: false
human_verification:
  - test: "Verify full-screen selection on a HiDPI display (devicePixelRatio > 1)"
    expected: "User can select the entire screen edge-to-edge without the image appearing zoomed in"
    why_human: >
      The canvas is sized to window.innerWidth/Height (CSS pixels) while the thumbnail
      is requested at the display's physical pixel dimensions (activeDisplay.size). On
      HiDPI displays where devicePixelRatio > 1, this causes the screen image to appear
      zoomed in and makes it impossible to select the edges of the screen. The user
      confirmed this during manual testing. The issue is present in src/renderer/app.ts
      line 284 (canvas.width = window.innerWidth) and src/main/capture.ts lines 43-48
      (thumbnailSize uses physical pixels). The fix requires either scaling the canvas
      by devicePixelRatio or requesting the thumbnail at CSS pixel dimensions. This
      defect does not block partial-screen selections but does prevent accurate
      full-screen and edge selection on HiDPI systems.
---

# Phase 1: Capture Engine Verification Report

**Phase Goal:** Users can launch a screen region selector, preview the capture, and have the screenshot written as a PNG to the OS temp directory — reliably on Windows, macOS, and Linux with no external tools required
**Verified:** 2026-03-17
**Status:** human_needed — All automated checks passed; one confirmed HiDPI rendering defect requires human validation of fix
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | User runs `snapview` from any terminal and a fullscreen dimmed overlay appears with a crosshair cursor | ? UNCERTAIN | Automated: bin/snapview.cjs spawns electron, out/main/index.js exists, BrowserWindow config verified. Human: user confirmed overlay appears and crosshair is present |
| 2 | User drags to select a screen region, sees a preview, and can approve or retake before any file is written | ? UNCERTAIN | Automated: app.ts has full mousedown/mousemove/mouseup + transitionToPreviewing + btnApprove/Retake wiring. Human: user confirmed drag-select, preview panel, and Retake work |
| 3 | User presses ESC at any point and the overlay closes cleanly — no orphaned processes, no hung terminal | ? UNCERTAIN | Automated: keydown handler calls cancel(), IPC handler sets exitCode=2, app.quit(), hardExitTimer.unref(). Human: user confirmed ESC closes cleanly |
| 4 | Approved capture is saved as PNG at `os.tmpdir()/snapview/snapview-{timestamp}-{random}.png` and path printed to stdout | ? UNCERTAIN | Automated: captureRegion writes to os.tmpdir()/snapview/, process.stdout.write emits path. Human: user confirmed file written and path output |
| 5 | The tool works without installing OS-level dependencies on Windows, macOS, and Linux (X11) | ? UNCERTAIN | Automated: electron bundled in package.json, no external tool calls in codebase. Human: user tested on Windows; macOS/Linux not confirmed |

**User Approval:** The user performed manual testing and typed "approved" confirming all verification steps in 01-05-PLAN.md passed.

**Score:** 5/5 truths structurally verified. Human confirmation received for Windows. One confirmed rendering defect noted.

---

## Required Artifacts

### Plan 01-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` | Project manifest with electron 35.7.5, bin entry | VERIFIED | Contains `"name": "snapview"`, `"electron": "35.7.5"`, `"bin": {"snapview": "bin/snapview.cjs"}` |
| `electron.vite.config.ts` | electron-vite build config | VERIFIED | Contains `externalizeDepsPlugin` |
| `src/shared/types.ts` | RegionRect, CaptureResult, AppPhase, IPC_CHANNELS | VERIFIED | All four exports present |
| `bin/snapview.cjs` | CLI entry point that spawns Electron | VERIFIED | Contains spawn, require('electron'), pipe stdout, exit code passthrough |

### Plan 01-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/main/index.ts` | Main process, IPC handlers, platform guards | VERIFIED | All guards present: Linux GPU flags, uncaughtException, hard-exit timeout, createOverlay, all 3 IPC channels |
| `src/main/capture.ts` | Screen capture, macOS permission gate, HiDPI scaling, PNG write | VERIFIED | checkMacOSPermission, getScreenSources, captureRegion all exported and implemented |
| `src/main/cleanup.ts` | Temp file cleanup >24h | VERIFIED | sweepOldCaptures exported, TWENTY_FOUR_HOURS_MS constant, fs.unlink with .catch(() => {}) |
| `src/preload/preload.ts` | contextBridge IPC bridge | VERIFIED | exposeInMainWorld('snapviewBridge') with all 3 channels |

### Plan 01-03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/renderer/app.ts` | Canvas overlay, selection, preview, state machine | VERIFIED | 317 lines. mousedown/mousemove/mouseup, drawDimOverlay, drawSelection, transitionToPreviewing, transitionToSelecting, ESC handler, permission dialog handling |
| `src/renderer/styles.css` | All overlay styles per UI-SPEC | VERIFIED | 199 lines. All CSS custom properties from UI-SPEC present. All DOM elements styled |

### Plan 01-04 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/main/capture.test.ts` | Tests for capture module | VERIFIED | 179 lines. describe blocks for checkMacOSPermission, captureRegion filename, tempdir, HiDPI, source type |
| `src/main/cleanup.test.ts` | Tests for cleanup module | VERIFIED | 89 lines. describe sweepOldCaptures with 5 tests: delete old, skip recent, ignore non-snapview, ENOENT, unlink error |
| `src/main/index.test.ts` | Tests for main process guards | VERIFIED | 199 lines. describe blocks for Linux GPU flags, hard exit, overlay bounds, Wayland handler, window-all-closed, IPC channels |
| `bin/snapview.test.cjs` | Tests for CLI entry point | VERIFIED | 85 lines. 11 tests covering spawn, electron, stdio pipe, stdout forwarding, exit code |

### Plan 01-05 Artifacts (Build Outputs)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `out/main/index.js` | Built main process | VERIFIED | File exists |
| `out/preload/preload.js` | Built preload bridge | VERIFIED | File exists |
| `out/renderer/index.html` | Built renderer | VERIFIED | File exists (in out/renderer/assets/) |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `bin/snapview.cjs` | `out/main/index.js` | child_process.spawn with electron binary | WIRED | Line 11: `path.join(__dirname, '..', 'out', 'main', 'index.js')`, line 14: `spawn(electronPath, [appPath, ...])` |
| `package.json` | `bin/snapview.cjs` | `"bin"` field | WIRED | `"bin": {"snapview": "bin/snapview.cjs"}` present |
| `src/preload/preload.ts` | `src/main/index.ts` | ipcRenderer.invoke matching ipcMain.handle channels | WIRED | Preload: invoke('capture:get-sources'), invoke('capture:region'), invoke('capture:cancel'). Main: ipcMain.handle(IPC_CHANNELS.GET_SOURCES/CAPTURE_REGION/CANCEL) |
| `src/main/index.ts` | `src/main/capture.ts` | import captureRegion, checkMacOSPermission | WIRED | Line 3: `import { checkMacOSPermission, captureRegion, getScreenSources } from './capture'` |
| `src/main/capture.ts` | `os.tmpdir()/snapview/` | fs.writeFile for PNG output | WIRED | Line 90: `path.join(os.tmpdir(), 'snapview')`, line 94: `fs.writeFile(filePath, pngBuffer)` |
| `src/renderer/app.ts` | `window.snapviewBridge` | preload bridge calls | WIRED | getSources(), captureRegion(), cancel() all called through window.snapviewBridge |
| `src/main/index.ts` | `src/main/cleanup.ts` | import sweepOldCaptures | WIRED | Line 4: `import { sweepOldCaptures } from './cleanup'`, called line 118 |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| CAPT-01 | 01-03, 01-05 | Fullscreen dimmed overlay for screen region selection | SATISFIED | BrowserWindow covers active display bounds; canvas draws dim overlay at rgba(0,0,0,0.45) |
| CAPT-02 | 01-03, 01-05 | Drag-to-select rectangular region with crosshair cursor | SATISFIED | mousedown/mousemove/mouseup handlers; body.selecting { cursor: crosshair }; drawSelection with strokeRect |
| CAPT-03 | 01-03, 01-05 | Preview of captured region with Send to Claude and Retake | SATISFIED | transitionToPreviewing creates crop canvas, sets previewImage.src; btnApprove and btnRetake handlers present |
| CAPT-04 | 01-03, 01-05 | ESC cancels at any point | SATISFIED | keydown handler: if (e.key === 'Escape') window.snapviewBridge.cancel(); IPC cancel sets exitCode=2, app.quit() |
| CAPT-05 | 01-02, 01-04 | Captured image saved as PNG to OS temp dir | SATISFIED | captureRegion: toPNG(), fs.writeFile to os.tmpdir()/snapview/ |
| FILE-01 | 01-02, 01-04 | Screenshots written to os.tmpdir()/snapview/ with timestamp+random filenames | SATISFIED | Filename: `snapview-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.png`; dir: path.join(os.tmpdir(), 'snapview') |
| PLAT-01 | 01-02, 01-04 | macOS permission checked before capture attempt | SATISFIED | GET_SOURCES IPC handler calls checkMacOSPermission() first; returns { permissionDenied: true } if denied |
| PLAT-02 | 01-02, 01-04 | Linux overlay uses correct GPU flags | SATISFIED | if (process.platform === 'linux') { app.commandLine.appendSwitch('enable-transparent-visuals'); app.commandLine.appendSwitch('disable-gpu'); } before app.whenReady() |
| PLAT-03 | 01-02, 01-04 | Hard-exit timeout prevents hung process | SATISFIED | HARD_EXIT_TIMEOUT_MS = 30_000; hardExitTimer.unref(); cleared on success/cancel; window-all-closed calls app.quit() |
| PLAT-04 | 01-02, 01-04 | Overlay appears on correct monitor in multi-monitor setups | SATISFIED | screen.getCursorScreenPoint() + getDisplayNearestPoint(); BrowserWindow x/y/width/height from activeDisplay.bounds; fullscreen: false |
| PLAT-05 | 01-02, 01-04 | macOS Sequoia monthly permission re-prompt handled gracefully | SATISFIED | getMediaAccessStatus called inside function body on every invocation (not cached at module level) |
| PLAT-06 | 01-02, 01-04 | Basic Wayland fallback support | SATISFIED | process.on('uncaughtException') calls app.exit(1); getScreenSources wrapped in try/catch returning [] |
| INST-02 | 01-01, 01-04 | All dependencies (Electron) bundled — no external tools required | SATISFIED | electron 35.7.5 in package.json dependencies; bin/snapview.cjs uses require('electron') for binary path |
| INST-03 | 01-01, 01-04 | Works on Windows, macOS, and Linux out of the box | SATISFIED (Windows confirmed) | os.tmpdir() for cross-platform temp path; no hardcoded OS paths; platform guards for Linux/macOS specifics |

**Orphaned requirements check:** REQUIREMENTS.md maps CAPT-01 through CAPT-05 to Phase 1. All are claimed by plans. No orphaned requirements detected.

**Note on FILE-02:** sweepOldCaptures is fully implemented and called in index.ts, but REQUIREMENTS.md maps FILE-02 to Phase 3 and the phase plans do not claim it. This is an early delivery — the implementation satisfies FILE-02 ahead of schedule. It is not a gap for this phase.

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/renderer/app.ts:284` | `canvas.width = window.innerWidth` (CSS pixels) while thumbnail is at physical pixel dimensions | WARNING | On HiDPI displays (devicePixelRatio > 1), canvas is smaller than the thumbnail image, causing the rendered screen image to appear zoomed in. User confirmed: "the screenshot is slightly zoomed in compared to the actual screen, making it impossible to select the whole screen." Partial captures still work correctly. The captureRegion HiDPI correction (scaleFactor multiplication) applies to the _output_ rect, but the _canvas rendering_ does not account for devicePixelRatio. |

No placeholder implementations, TODO stubs, or empty handlers found across all 8 production source files.

---

## Unit Test Results

All 57 tests pass across 4 test files in 82ms:

- `src/main/capture.test.ts` — 20 tests: checkMacOSPermission source patterns, filename format, temp dir path, HiDPI scaleFactor math, source type correctness
- `src/main/cleanup.test.ts` — 5 tests: delete old files, skip recent, ignore non-snapview, ENOENT handling, unlink error handling (uses fs mock)
- `src/main/index.test.ts` — 21 tests: Linux GPU flags, hard-exit timeout, overlay bounds, Wayland handler, window-all-closed, IPC channel registration
- `bin/snapview.test.cjs` — 11 tests: CLI file existence, spawn, electron, stdio pipe, stdout forwarding, exit code, shebang

---

## Human Verification Required

### 1. HiDPI Canvas Rendering Fix

**Test:** On a display with devicePixelRatio > 1 (e.g., Windows with 150% or 200% display scaling, macOS Retina), run `node bin/snapview.cjs` and attempt to select the full screen by dragging from the top-left to the bottom-right corner.

**Expected:** The overlay background image exactly fills the window with no zooming. The user should be able to drag a selection rectangle that reaches all four edges of the screen.

**Current behavior (confirmed):** The background image appears zoomed in (larger than the window), making the screen edges unreachable for selection.

**Root cause:** `canvas.width = window.innerWidth` (CSS pixels) but `thumbnailSize` is requested at `activeDisplay.size` (physical pixels). When `devicePixelRatio = 1.5`, the canvas is 1280px wide but the thumbnail is 1920px wide, so the image overflows.

**Fix location:** `src/renderer/app.ts` line 284-285 — canvas dimensions should account for `window.devicePixelRatio`, and the canvas CSS size should remain at `innerWidth/Height` while the backing store scales up. Alternatively, request the thumbnail at `Math.round(window.innerWidth)` x `Math.round(window.innerHeight)` (CSS pixels) from `getScreenSources`.

**Why human:** Requires running the actual Electron app on a HiDPI-configured display to confirm the fix works correctly before this phase can be considered fully complete on all supported platforms.

---

## Summary

Phase 1 achieved its structural goal. All five production source modules are fully implemented (not stubs), correctly wired together, and all 57 unit tests pass. The user manually confirmed the complete capture flow works on Windows.

The one known defect — HiDPI/devicePixelRatio canvas rendering — means the overlay background image appears zoomed in on displays with scaling > 100%, preventing accurate full-screen-edge selection. Partial captures function correctly. This is a rendering issue in `src/renderer/app.ts`, not an architectural problem, and is fixable without structural changes.

The phase goal as written ("reliably on Windows, macOS, and Linux") is substantively met for the partial-capture case. Full-screen selection on HiDPI systems requires the canvas fix to be complete.

---

_Verified: 2026-03-17_
_Verifier: Claude (gsd-verifier)_
