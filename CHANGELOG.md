# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.1.2]: https://github.com/Grips001/snapview/releases/tag/v1.1.2
[1.1.1]: https://github.com/Grips001/snapview/releases/tag/v1.1.1
[1.1.0]: https://github.com/Grips001/snapview/releases/tag/v1.1.0
[1.0.5]: https://github.com/Grips001/snapview/releases/tag/v1.0.5
[1.0.4]: https://github.com/Grips001/snapview/releases/tag/v1.0.4
[1.0.0]: https://github.com/Grips001/snapview/releases/tag/v1.0.0
