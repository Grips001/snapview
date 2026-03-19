# Snapview

[![npm](https://img.shields.io/npm/v/snapview)](https://www.npmjs.com/package/snapview)
[![CI](https://github.com/Grips001/snapview/actions/workflows/ci.yml/badge.svg)](https://github.com/Grips001/snapview/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Show Claude what you're looking at — capture any screen region and inject it into your Claude Code conversation in under 3 seconds.

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

or with bun:

```bash
bun add -g snapview
```

The installer automatically registers the `/snapview` skill and auto-trigger hook into Claude Code.

### Verify

```bash
snapview
```

A transparent overlay should appear on your screen. Press `Esc` to close it.

### Update

```bash
npm i -g snapview@latest   # or: bun add -g snapview@latest
```

The postinstall script re-registers the skill and hooks automatically, so no extra steps are needed.

### Uninstall

```bash
snapview uninstall        # Remove skill, hooks, and settings
npm uninstall -g snapview # or: bun remove -g snapview
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

When enabled (default), Claude can automatically launch a capture when it needs to see your screen. The first time an auto-trigger occurs, Snapview will ask for your confirmation before proceeding — this approval is remembered so you won't be asked again.

Toggle with:

```json
{ "env": { "SNAPVIEW_AUTO_TRIGGER": "0" } }
```

in `~/.claude/settings.json`.

## How it works

Snapview is an Electron app that creates a transparent fullscreen overlay on the monitor where your cursor is — **multi-monitor setups are fully supported**, so you can capture from any display without switching focus. You drag to select a region, preview the capture, then approve or retake. The screenshot is saved as a temporary PNG in your system temp directory with automatic 24-hour cleanup.

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

## What people are saying

> "SnapView solves one of those small but persistent frustrations — getting screenshots into Claude Code. It's lightweight, intuitive, and makes the workflow feel the way it should have from the start."

## Security Note

Snapview stores screenshots as temporary PNGs in your system temp directory (`os.tmpdir()/snapview/`). These files may contain sensitive content visible on your screen at the time of capture. On shared machines or multi-user systems:

- Files are automatically deleted after 24 hours (configurable via `SNAPVIEW_RETENTION_HOURS`)
- Set `SNAPVIEW_RETENTION_HOURS=1` for faster cleanup in sensitive environments
- Promoted screenshots (saved to `./screenshots/`) are **not** auto-cleaned — manage these manually and consider adding `screenshots/` to your `.gitignore`

## License

[MIT](LICENSE)
