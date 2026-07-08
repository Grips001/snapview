# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Snapview

Cross-platform screenshot capture CLI built with Electron, designed for Claude Code integration. Users capture screen regions via `/snapview` command or auto-trigger hook, producing temporary PNG files injected into Claude conversations.

## Commands

```bash
bun install          # Install dependencies
bun run dev          # Electron dev mode with hot reload
bun run build        # Production build via electron-vite (uses electron-vite.config.ts)
bun run typecheck    # TypeScript checking (main + renderer configs)
bun test             # Run all tests (bun:test, 147 tests across 6 files)
```

Global install (triggers postinstall that registers skill + hooks into `~/.claude/`):
```bash
npm i -g .
```

## Publishing

Uses **trusted publishing** via GitHub Actions — do not run `npm publish` locally.

When the user asks to commit and push changes, always perform the full release flow:

1. Bump the version in `package.json` — patch for fixes (e.g., `1.1.2` → `1.1.3`), minor for new user-facing features (e.g., `1.3.0` → `1.4.0`)
2. Add a dated entry to `CHANGELOG.md` following the existing format, with a link reference at the bottom
3. Commit all changes (including lockfile if changed) and push to `main`
4. Create a git tag `v{version}` pointing to the pushed commit and push it
5. Create a GitHub Release via `gh release create v{version}` with release notes from the changelog — this triggers the `publish.yml` workflow which builds, tests, and publishes to npm with `--provenance`
6. CI runs on all pushes/PRs: typecheck → build → test across ubuntu/windows/macos (Node 24)

## Architecture

**4-layer Electron architecture:**

1. **CLI entry** (`bin/snapview.cjs`) — Spawns Electron process, pipes stdout through unmodified (JSON envelope `{filePath, promptText}`)
2. **Main process** (`src/main/`) — Window creation (Ready confirmation applet + per-display capture overlays), IPC routing, screen capture via `desktopCapturer`, PNG file output to `os.tmpdir()/snapview/`
3. **Preload bridge** (`src/preload/preload.ts`) — `contextBridge` exposing IPC channels with runtime validation (no `nodeIntegration`)
4. **Renderer** (`src/renderer/`) — Ready confirmation applet (`?mode=ready`), canvas-based transparent overlay with drag-to-select, preview panel (approve/retake + optional prompt text box) with cancel/X at every step; one overlay instance per connected display

**Claude Code integration:**
- `claude-integration/SKILL.md` — `/snapview` slash command definition
- `scripts/snapview-autotrigger.js` — Stop hook that detects `{"snapview_capture":true}` signal (fast substring scan before JSON parse), passes `--auto-trigger` flag, exits silently on failure
- `scripts/postinstall.cjs` — Installs skill, hook script, and merges settings into `~/.claude/`

**Auto-trigger confirmation (one-time, separate from the per-capture Ready applet below):**
- First auto-triggered capture shows a native OS dialog asking whether Claude may request captures at all going forward
- Approval persisted to `~/.snapview/config.json` so it's only asked once
- Denial exits with code 2 (same as manual cancel)

**Ready confirmation applet (every capture, manual or auto-triggered):**
- Before the full-screen capture overlays are created, `createReadyWindow()` shows a small, non-fullscreen, always-on-top `BrowserWindow` ("Claude is requesting a screenshot. Click 'Ready' when you are ready to take it.") so the user can arrange their screen — it does not block input to the rest of the screen
- Loads the same `index.html`/`app.ts` bundle as the capture overlays, distinguished via `?mode=ready` query param, so it only renders `#ready-dialog` and skips canvas/selection setup
- Clicking Ready sends `capture:ready-confirmed`. Handler order matters: **hide the Ready window → `await createOverlays()` → close it** — not close-then-create. Closing first briefly leaves zero windows open (triggers `window-all-closed`, quitting the app before the overlay ever appears); leaving it visible instead of hidden lets it flash back above the new overlay since both share the `screen-saver` always-on-top level. The X/Cancel button reuses the existing `capture:cancel` path (exit code 2).

**IPC channels** (defined in `src/shared/types.ts`):
- `capture:get-sources` — macOS permission check (returns `permissionDenied` or `permissionGranted`)
- `capture:region` — Crop region, encode PNG, write to temp, output `{filePath, promptText}` JSON to stdout
- `capture:cancel` — Quit with exit code 2
- `capture:ready-confirmed` — Renderer → main: user clicked "Ready" on the pre-capture confirmation applet; main closes it and creates the capture overlays
- `capture:display-info` — Main → renderer: push per-display thumbnail, displayId, scaleFactor after window load
- `capture:drag-started` — Renderer → main: notify that this window started a selection
- `capture:selection-state` — Main → renderer: broadcast `'active'`/`'inactive'` to coordinate multi-monitor overlays
- `capture:selection-reset` — Renderer → main: retake resets all windows to active

**Constants:** `src/main/constants.ts` exports `SNAPVIEW_TEMP_DIR` — single source of truth for temp path, kept in main (not shared) to avoid `os`/`path` leaking into sandboxed preload.

**Output:** Ephemeral PNGs in `os.tmpdir()/snapview/` with 24-hour auto-cleanup (configurable via `SNAPVIEW_RETENTION_HOURS`).

## Security

- **Sandbox enabled** — BrowserWindow runs with Chromium sandbox; preload uses only `contextBridge` + `ipcRenderer`
- **CSP** — Renderer HTML has strict Content-Security-Policy (`default-src 'none'`, allows only local scripts/styles and `data:`/`blob:` for preview images)
- **Navigation/window guards** — `will-navigate` blocked, `setWindowOpenHandler` denies all
- **Preload validation** — Runtime rect type checks, NaN/Infinity/bounds validation, property stripping before IPC

## Platform-Specific Concerns

- **macOS:** Screen Recording permission check before capture; handles `not-determined`/`denied`/`granted` states
- **Linux:** `enable-transparent-visuals` and `disable-gpu` flags applied before `app.whenReady()` to prevent opaque overlay on X11/NVIDIA; Wayland portal dismissal wrapped in try/catch; `roundedCorners: false` set explicitly on the overlay and Ready windows since Electron 43 defaults frameless windows to rounded corners on Linux, which would otherwise put gaps at the corners of the full-bleed overlay
- **Multi-monitor:** One BrowserWindow per connected display via `screen.getAllDisplays()`; sources matched by `display_id` with index fallback; `findSourceForDisplay()` helper shared by `getAllDisplaySources()` and `captureRegion()`
- **HiDPI:** Per-display `scaleFactor` applied to region coordinates; canvas scaled by `devicePixelRatio`
- **Hard exit:** 30-second timeout guards only against `app.whenReady()` never resolving — cleared at the top of the `whenReady().then()` callback so it never fires mid-interaction (native approval dialog, Ready applet, or typing a note)

## Testing Patterns

Tests use `bun:test`. Key patterns:
- Pure function extraction for testable capture logic (filename generation, scaleFactor math)
- Cross-platform mock binaries (`.cmd` on Windows, sh on Unix)
- `HOME`/`USERPROFILE` override for filesystem isolation
- Source-level pattern verification for module load-time side effects

## Module Resolution

- Main process (`tsconfig.main.json`): NodeNext — requires explicit extensions
- Renderer (`tsconfig.renderer.json`): ESNext with bundler resolution
- Built output: `out/main/` and `out/renderer/` (electron-vite)
