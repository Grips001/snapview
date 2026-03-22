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
bun test             # Run all tests (bun:test, 110 tests across 6 files)
```

Global install (triggers postinstall that registers skill + hooks into `~/.claude/`):
```bash
npm i -g .
```

## Publishing

Uses **trusted publishing** via GitHub Actions — do not run `npm publish` locally.

When the user asks to commit and push changes, always perform the full release flow:

1. Bump the patch version in `package.json` (e.g., `1.1.2` → `1.1.3`)
2. Add a dated entry to `CHANGELOG.md` following the existing format, with a link reference at the bottom
3. Commit all changes (including lockfile if changed) and push to `main`
4. Create a git tag `v{version}` pointing to the pushed commit and push it
5. Create a GitHub Release via `gh release create v{version}` with release notes from the changelog — this triggers the `publish.yml` workflow which builds, tests, and publishes to npm with `--provenance`
6. CI runs on all pushes/PRs: typecheck → build → test across ubuntu/windows/macos (Node 24)

## Architecture

**4-layer Electron architecture:**

1. **CLI entry** (`bin/snapview.cjs`) — Spawns Electron process, captures stdout for file path output
2. **Main process** (`src/main/`) — Window creation, IPC routing, screen capture via `desktopCapturer`, PNG file output to `os.tmpdir()/snapview/`
3. **Preload bridge** (`src/preload/preload.ts`) — `contextBridge` exposing 3 IPC channels (no `nodeIntegration`)
4. **Renderer** (`src/renderer/`) — Canvas-based transparent overlay with drag-to-select, preview panel, approve/retake flow

**Claude Code integration:**
- `claude-integration/SKILL.md` — `/snapview` slash command definition
- `scripts/snapview-autotrigger.js` — Stop hook that detects `{"snapview_capture":true}` signal (fast substring scan before JSON parse), passes `--auto-trigger` flag, exits silently on failure
- `scripts/postinstall.cjs` — Installs skill, hook script, and merges settings into `~/.claude/`

**Auto-trigger confirmation:**
- First auto-triggered capture shows a native OS dialog asking user permission
- Approval persisted to `~/.snapview/config.json` so it's only asked once
- Denial exits with code 2 (same as manual cancel)

**IPC channels** (defined in `src/shared/types.ts`):
- `capture:get-sources` — Fetch screen sources (handles macOS permission check)
- `capture:region` — Crop region, encode PNG, write to temp, output path to stdout
- `capture:cancel` — Quit with exit code 2

**Constants:** `src/main/constants.ts` exports `SNAPVIEW_TEMP_DIR` — single source of truth for temp path, kept in main (not shared) to avoid `os`/`path` leaking into sandboxed preload.

**Output:** Ephemeral PNGs in `os.tmpdir()/snapview/` with 24-hour auto-cleanup (configurable via `SNAPVIEW_RETENTION_HOURS`).

## Security

- **Sandbox enabled** — BrowserWindow runs with Chromium sandbox; preload uses only `contextBridge` + `ipcRenderer`
- **CSP** — Renderer HTML has strict Content-Security-Policy (`default-src 'none'`, allows only local scripts/styles and `data:`/`blob:` for preview images)
- **Navigation/window guards** — `will-navigate` blocked, `setWindowOpenHandler` denies all
- **Preload validation** — Runtime rect type checks, NaN/Infinity/bounds validation, property stripping before IPC

## Platform-Specific Concerns

- **macOS:** Screen Recording permission check before capture; handles `not-determined`/`denied`/`granted` states
- **Linux:** `enable-transparent-visuals` and `disable-gpu` flags applied before `app.whenReady()` to prevent opaque overlay on X11/NVIDIA; Wayland portal dismissal wrapped in try/catch
- **Multi-monitor:** Overlay positioned on monitor where cursor is via `screen.getCursorScreenPoint()`
- **HiDPI:** `scaleFactor` applied to region coordinates; canvas scaled by `devicePixelRatio`
- **Hard exit:** 30-second timeout prevents Electron process hangs

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
