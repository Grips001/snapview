# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2026-07-07

### Added

- **Ready/Cancel confirmation applet** — a small, non-blocking window shown before every capture (manual or auto-triggered) so users can arrange their screen; "Ready" opens the capture overlay, the X/Cancel button exits with the standard cancel code. Independent of the existing one-time native auto-trigger approval dialog.
- **Prompt text box in the preview panel** — an optional textarea lets users add context to send alongside the screenshot, plus a Cancel/X button on the preview panel itself
- `capture:ready-confirmed` IPC channel and `confirmReady()` preload method
- `?mode=ready` renderer entry point — the Ready applet reuses `index.html`/`app.ts`, rendering only the confirmation dialog and skipping canvas/selection setup

### Changed

- **Breaking: CLI stdout is now a JSON envelope** `{"filePath": "...", "promptText": "..."}` instead of a bare file path — updated in `scripts/snapview-autotrigger.js` and `claude-integration/SKILL.md`'s read-back instructions
- `RegionRect` and `CaptureResult` gained an optional `promptText` field

## [1.3.0] - 2026-03-24

### Added

- **Multi-monitor overlay** — creates one BrowserWindow per connected display simultaneously instead of only covering the cursor's monitor. Drag to select on any monitor; the others dim automatically.
- Per-display DPI handling — each overlay uses its own display's native `scaleFactor`, eliminating the mixed-DPI bug that affects single spanning windows
- `desktopCapturer` source matching by `display_id` — captures the correct monitor's content, with index-based fallback for Linux compositors that don't populate `display_id`
- Multi-monitor IPC synchronization protocol: `DRAG_STARTED`, `SELECTION_STATE`, `SELECTION_RESET` channels coordinate active/inactive state across all overlay windows
- `DisplayInfo` interface and `displayId` field on `RegionRect` for per-display capture routing
- `findSourceForDisplay()` helper — shared `display_id` matching logic used by both `getAllDisplaySources()` and `captureRegion()`
- `getAllDisplaySources()` — fetches and matches screen sources for all connected displays in one pass
- Preload bridge methods: `onDisplayInfo`, `onSelectionState`, `notifyDragStart`, `notifyRetake`
- `displayId` validation in preload rect sanitization

### Changed

- Overlay thumbnail resolution now uses the largest connected display's dimensions instead of hardcoded 1920x1080
- Main process pushes display info to renderers via `DISPLAY_INFO` channel instead of renderers pulling via `GET_SOURCES`
- `captureRegion()` finds target display by `rect.displayId` with `getActiveDisplay()` fallback
- Retake flow resets all monitors to active state via `SELECTION_RESET` broadcast

### Removed

- Dead `getScreenSources()` function — replaced by `getAllDisplaySources()` for multi-monitor flow
- Unused `getActiveDisplay` import from `index.ts` — only used internally within `capture.ts`

## [1.2.1] - 2026-03-24

### Changed

- Repositioned README, package description, and SKILL.md to differentiate from Claude Code's native clipboard paste — leads with workflow differentiators (Claude-requested captures, preview gate, precision region selection, automatic lifecycle, cross-platform consistency)
- Added "Why Snapview when Claude Code can paste images?" section to README
- Added "When to use this vs clipboard paste" guidance to SKILL.md so Claude knows when to reach for `/snapview` vs suggesting native paste
- Updated package description to reflect capture workflow positioning

## [1.2.0] - 2026-03-22

### Removed

- Unused `commander` dependency — was declared but never imported, shipped ~50KB to every consumer for nothing
- Redundant `package-lock.json` — Bun is the canonical package manager; npm consumers resolve from the registry, not the repo lockfile
- Redundant `.npmignore` — `package.json` `"files"` whitelist is the authoritative publish filter; `.npmignore` duplicated every exclusion and referenced non-existent paths

### Changed

- DRY: `createOverlay()` now imports `getActiveDisplay()` from `capture.ts` instead of duplicating the cursor/display lookup inline
- DRY: Removed 3 redundant `clearTimeout(hardExitTimer)` calls from IPC handlers — `app.on('will-quit')` already handles timer cleanup for all `app.quit()` paths (kept the one before `app.exit(2)` which bypasses `will-quit`)
- Removed `screen` from Electron imports in `index.ts` — no longer used directly after `getActiveDisplay()` refactor
- Test updated to verify `getActiveDisplay()` usage instead of raw `screen` API calls

## [1.1.4] - 2026-03-22

### Fixed

- Quoted hook command path in postinstall script — paths with spaces (e.g., `C:/Users/John Doe/...`) broke because `node` received the path as multiple arguments
- Added test to verify hook command path quoting

## [1.1.3] - 2026-03-20

### Reverted

- Removed `global-agent` override added in 1.1.2 — npm `overrides` only apply to root projects, not to consumers installing the package; the `boolean@3.2.0` deprecation warning is an upstream issue in `@electron/get` pinning `global-agent@^3.0.0`

## [1.1.2] - 2026-03-20

### Fixed

- Resolved `boolean@3.2.0` deprecation warning during install — overrides `global-agent` to 4.x which dropped the deprecated dependency (`@electron/get` → `global-agent@^3.0.0` was the only 3.x release)

## [1.1.1] - 2026-03-19

### Changed

- Expanded npm keywords (`anthropic`, `ai`, `visual-context`, `developer-tools`) for better search discoverability
- Updated GitHub repo description and homepage URL to cross-link with npm

## [1.1.0] - 2026-03-19

### Added

- First-time auto-trigger confirmation dialog — native OS prompt asks "Claude is requesting to see your screen" before the first auto-triggered capture, approval persisted to `~/.snapview/config.json`
- Node.js version check at CLI startup with clear error message and download link
- Platform-specific error hints when screen capture fails (macOS permission guidance, Linux compositor hint)
- Wayland-specific error messaging with actionable X11 guidance
- `unhandledRejection` handler for reliable async error reporting
- Content Security Policy (CSP) on renderer HTML — blocks all by default, allows only local scripts/styles and image data/blob URLs
- Navigation and window-open guards on overlay (`will-navigate` blocked, `setWindowOpenHandler` denies)
- Runtime rect validation in preload bridge — type checks, bounds validation, property stripping before IPC
- Auto-trigger signal documentation in SKILL.md so Claude can learn the `{"snapview_capture":true}` format
- Update instructions in README
- User testimonial section in README
- `electron-vite.config.ts` with explicit entry points and minification

### Changed

- **Security: sandbox enabled** — removed `sandbox: false` from BrowserWindow; preload only uses `contextBridge` and `ipcRenderer`, both sandbox-compatible since Electron 20
- **Performance: eliminated data URL round-trip** — `captureRegion` now crops directly from `NativeImage` instead of encoding to base64 data URL then decoding back
- **Performance: cached dim overlay** — screen image + dim layer rendered once to `OffscreenCanvas`, reused as single GPU blit on every mousemove frame (eliminates 2 full-canvas redraws per frame)
- **Performance: `toBlob` + `createObjectURL`** replaces `toDataURL` for preview — avoids CPU-bound PNG base64 encoding
- **Performance: cleanup uses filename timestamps** — parses creation time from `snapview-{timestamp}-{uuid}.png` filenames instead of N `fs.stat()` syscalls
- **Performance: fast-path trigger detection** — substring scan before `JSON.parse` in Stop hook; avoids expensive exception on 99.99% of non-trigger messages
- **Performance: build output minified** — main 7.9KB→5.1KB, renderer JS 5.4KB→3.3KB, CSS 4.6KB→2.6KB
- Auto-trigger hook passes `--auto-trigger` flag to distinguish auto-triggered from manual captures
- Auto-trigger hook exits silently on capture failure instead of blocking Claude with an error message
- Removed `disable-model-invocation: true` from SKILL.md — Claude can now auto-invoke when it needs visual context
- Removed fake `askForMediaAccess('screen')` call — this API only accepts `'microphone'`/`'camera'`, was a type hack doing nothing
- `app.exit(2)` replaces `app.quit()` for pre-window denial — prevents orphaned processes on Windows (electron#2312)
- `dialog.showMessageBox` uses `noLink: true` for consistent button rendering on Windows
- `writeConfig` wrapped in try/catch — config write failure no longer blocks capture
- `will-quit` handler clears hard-exit timer on all quit paths
- `hasShadow: false` for clean transparent overlay on Linux Wayland
- Canvas stroke properties set once at init instead of per frame
- `parseInt` for Node version check instead of `split('.').map(Number)`
- `fs.copyFileSync` in postinstall instead of `readFileSync` + `writeFileSync`
- Short-circuit `isClaudeInPath()` — skips expensive PATH lookup when `~/.claude/` already exists
- `crypto.randomUUID()` replaces `crypto.randomBytes(8).toString('hex')` for filenames
- Removed redundant `require('process')` from autotrigger hook (global in Node.js)
- Removed redundant `alwaysOnTop: true` from BrowserWindow constructor (overridden by `setAlwaysOnTop`)
- Removed unnecessary `enableLargerThanScreen` (macOS-only, overlay matches display bounds)
- Removed unused `nativeImage` runtime import from capture module
- Removed unused `AppPhase` type export from shared types
- Removed unused `electron-builder` devDependency (~50MB)
- Removed unnecessary `declaration` and `sourceMap` from base tsconfig
- Removed `.planning/` directory (598KB of historical GSD artifacts)
- IPC channel constants imported from `shared/types.ts` in preload (was hardcoded strings)
- `SNAPVIEW_TEMP_DIR` extracted to `src/main/constants.ts` — single source of truth for capture + cleanup, kept out of `shared/types.ts` to prevent `os`/`path` leaking into sandboxed preload bundle
- DRY: `normalizeRect` helper in renderer (was computed identically in 4 places)
- DRY: `isNotSnapviewHook` filter in postinstall (was duplicated between install and uninstall)
- DRY: `readSettings`/`writeSettings` helpers in postinstall
- DRY: `getActiveDisplay` helper in capture (was querying cursor + display separately in multiple functions)
- Test suite expanded from 76 to 110 tests covering all new functionality

## [1.0.5] - 2026-03-19

### Changed

- Upgraded Electron from 35.7.5 to 41.0.3
- Upgraded @types/node from ^22.0.0 to ^25.5.0
- Updated GitHub Actions to v6 (actions/checkout, actions/setup-node) for Node.js 24 compatibility
- CI and publish workflows now use Node.js 24 LTS

## [1.0.4] - 2026-03-19

### Improved

- Clarified multi-monitor support in README — overlay opens on whichever display the cursor is on
- Added demo GIF to README landing page
- Added security note about temporary screenshot files in shared environments

## [1.0.0] - 2026-03-17

### Added

- Screen capture overlay with drag-to-select region selection
- Preview panel with approve/retake flow
- Claude Code `/snapview` skill for one-command capture
- Auto-trigger Stop hook — Claude can request captures automatically
- Automatic postinstall setup of skill, hook, and settings
- `snapview install` / `snapview uninstall` subcommands
- HiDPI/Retina display support with proper scaling
- Multi-monitor support (overlay appears on active monitor)
- macOS Screen Recording permission detection and guidance
- Linux X11 transparent overlay with GPU compositing workarounds
- 24-hour automatic temp file cleanup (configurable via `SNAPVIEW_RETENTION_HOURS`)
- Screenshot promotion — Claude offers to save important captures to `./screenshots/`

[1.4.0]: https://github.com/Grips001/snapview/releases/tag/v1.4.0
[1.3.0]: https://github.com/Grips001/snapview/releases/tag/v1.3.0
[1.2.1]: https://github.com/Grips001/snapview/releases/tag/v1.2.1
[1.2.0]: https://github.com/Grips001/snapview/releases/tag/v1.2.0
[1.1.4]: https://github.com/Grips001/snapview/releases/tag/v1.1.4
[1.1.3]: https://github.com/Grips001/snapview/releases/tag/v1.1.3
[1.1.2]: https://github.com/Grips001/snapview/releases/tag/v1.1.2
[1.1.1]: https://github.com/Grips001/snapview/releases/tag/v1.1.1
[1.1.0]: https://github.com/Grips001/snapview/releases/tag/v1.1.0
[1.0.5]: https://github.com/Grips001/snapview/releases/tag/v1.0.5
[1.0.4]: https://github.com/Grips001/snapview/releases/tag/v1.0.4
[1.0.0]: https://github.com/Grips001/snapview/releases/tag/v1.0.0
