# Snapview

[![npm](https://img.shields.io/npm/v/snapview)](https://www.npmjs.com/package/snapview)
[![CI](https://github.com/Grips001/snapview/actions/workflows/ci.yml/badge.svg)](https://github.com/Grips001/snapview/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Show Claude what you're looking at — capture any screen region and inject it into your Claude Code conversation.

<p align="center">
  <img src="docs/demo.gif" alt="Snapview capture demo" width="720" />
  <br />
  <em>Select a region → preview → approve — screenshot lands in your conversation</em>
</p>

## Install

Requires [Node.js 18+](https://nodejs.org/) and [Claude Code](https://claude.ai/code).

```bash
npm i -g snapview
```

The installer automatically registers the `/snapview` skill and auto-trigger hook into Claude Code.

### Verify

```bash
snapview
```

A transparent overlay should appear on your screen. Press `Esc` to close it.

### Update

```bash
npm i -g snapview@latest
```

The postinstall script re-registers the skill and hooks automatically, so no extra steps are needed.

### Uninstall

```bash
snapview uninstall        # Remove skill, hooks, and settings
npm uninstall -g snapview
```

## Usage

### From Claude Code

Type `/snapview` in any Claude Code conversation — a transparent overlay appears, drag to select a region, approve the capture, and the screenshot is injected into context.

### From the terminal

```bash
snapview
```

Launches the capture overlay directly. On success (exit code 0), the temporary PNG file path is printed to stdout. Exit code 2 means the user cancelled; exit code 1 means an error occurred.

### Auto-trigger

When enabled (default), Claude can automatically request a screen capture when it needs visual context. This works through a Claude Code [Stop hook](https://docs.anthropic.com/en/docs/claude-code/hooks) — when Claude includes a `{"snapview_capture":true}` signal in its response, the hook detects it and launches the capture UI. You still choose the region and approve before anything is shared.

The first time an auto-trigger occurs, a native OS dialog asks for your permission. This approval is persisted to `~/.snapview/config.json` so you're only asked once.

Disable auto-trigger by setting `SNAPVIEW_AUTO_TRIGGER` to `0` in `~/.claude/settings.json`:

```json
{ "env": { "SNAPVIEW_AUTO_TRIGGER": "0" } }
```

## How it works

Snapview is an Electron app that creates a transparent fullscreen overlay on the monitor where your cursor is — multi-monitor setups just work. You drag to select a region, preview the capture, then approve or retake. The screenshot is saved as a temporary PNG in your system temp directory with automatic 24-hour cleanup.

**Platform support:**
- **Windows** — Works out of the box
- **macOS** — Requires Screen Recording permission (prompted on first use)
- **Linux/X11** — Supported with GPU compositing workarounds applied automatically

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `SNAPVIEW_AUTO_TRIGGER` | `1` | Enable (`1`) or disable (`0`) auto-trigger hook |
| `SNAPVIEW_RETENTION_HOURS` | `24` | Hours to retain temporary screenshots before cleanup |

Set these in `~/.claude/settings.json` under the `env` key.

## Troubleshooting

### macOS: Black or empty screenshot

macOS requires Screen Recording permission for Snapview to capture your screen. If you get a black image or the capture fails:

1. Open **System Settings > Privacy & Security > Screen Recording**
2. Find your terminal app (Terminal, iTerm2, Warp, etc.) and enable it
3. Restart your terminal — the permission change requires a fresh session

Note: macOS Sequoia may re-prompt for this permission periodically.

### Linux: Opaque overlay or capture fails

Snapview applies GPU compositing workarounds automatically for X11, but some setups still have issues:

- **Wayland** is not fully supported. If capture fails, try running with `XDG_SESSION_TYPE=x11` or switch to an X11 session.
- **NVIDIA drivers on X11** — the `disable-gpu` and `enable-transparent-visuals` flags are applied automatically. If the overlay is still opaque, check that your compositor supports transparent windows.

### Capture window doesn't appear

- Run `snapview` directly in your terminal to see error output
- Ensure Node.js 18+ is installed: `node --version`
- On macOS, check that Screen Recording permission is granted (see above)

### Auto-trigger not working

- Verify the hook is registered: check `~/.claude/settings.json` for a `Stop` hook entry pointing to `snapview-autotrigger.js`
- Ensure `SNAPVIEW_AUTO_TRIGGER` is not set to `0`
- Reinstall to re-register hooks: `npm i -g snapview`

## Security

Snapview stores screenshots as temporary PNGs in your system temp directory (`os.tmpdir()/snapview/`). These files may contain sensitive content visible on your screen at the time of capture:

- Files are automatically deleted after 24 hours (configurable via `SNAPVIEW_RETENTION_HOURS`)
- Set `SNAPVIEW_RETENTION_HOURS=1` for faster cleanup in sensitive environments
- Promoted screenshots (saved to `./screenshots/`) are **not** auto-cleaned — manage these manually and consider adding `screenshots/` to your `.gitignore`

The Electron renderer runs with full sandboxing, context isolation, and a strict Content Security Policy. No data leaves your machine — screenshots are stored locally and read directly by Claude Code.

## Development

```bash
bun install          # Install dependencies
bun run dev          # Electron dev mode with hot reload
bun run build        # Production build
bun run typecheck    # TypeScript checking
bun test             # Run all tests
```

### Architecture

Snapview has four layers:

1. **CLI entry** (`bin/snapview.cjs`) — Spawns the Electron process and captures stdout for the file path
2. **Main process** (`src/main/`) — Window creation, IPC routing, screen capture via `desktopCapturer`, PNG output
3. **Preload bridge** (`src/preload/`) — `contextBridge` exposing 3 IPC channels with runtime validation
4. **Renderer** (`src/renderer/`) — Canvas-based transparent overlay with drag-to-select and preview panel

Claude Code integration lives in `claude-integration/SKILL.md` (skill definition) and `scripts/snapview-autotrigger.js` (Stop hook).

## License

[MIT](LICENSE)
