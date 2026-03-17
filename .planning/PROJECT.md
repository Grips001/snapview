# Snapview

## What This Is

A native screenshot capture tool for Claude Code that lets users instantly share what's on their screen with Claude. Users type `/snapview` (or Claude auto-triggers it) and get an overlay to select a screen region, preview it, and send it directly into the conversation. Built as a lightweight Electron app distributed via npm/bun with hooks-based Claude Code integration. Includes screenshot promotion to project directory and configurable auto-cleanup.

## Core Value

Users can share any part of their screen with Claude in under 3 seconds, without leaving the terminal workflow.

## Requirements

### Validated

- ✓ Screen capture overlay with drag-to-select region selection — v1.0
- ✓ Preview window with approve/retake flow before sending — v1.0
- ✓ Image injection into Claude Code session via temp file + Read tool — v1.0
- ✓ Manual trigger via `/snapview` skill command — v1.0
- ✓ Auto-trigger: Claude can request a screenshot via Stop hook — v1.0
- ✓ Ephemeral storage: screenshots saved to OS temp directory, configurable auto-cleanup — v1.0
- ✓ Cross-platform support (Windows, macOS, Linux) via Electron 35.7.5 — v1.0
- ✓ One-command installation via `npm i -g snapview` / `bun add -g snapview` — v1.0
- ✓ Hooks-based integration with Claude Code (Stop hook + SKILL.md) — v1.0
- ✓ Bundled dependencies — install and use immediately — v1.0
- ✓ Screenshot promotion to project directory via Claude judgment — v1.0
- ✓ HiDPI/Retina display rendering — v1.0
- ✓ Platform safety guards (macOS permissions, Linux GPU, multi-monitor, Wayland fallback) — v1.0

### Active

- [ ] Clipboard copy on capture (descoped from v1.0 — FILE-03)

### Out of Scope

- Screenshot annotation (arrows, boxes, text) — designed for future addition but not v1
- Video/screen recording — capture only, not streaming
- Cloud storage or sharing — images stay local
- Mobile/tablet support — desktop CLI tool only
- OCR or text extraction from screenshots — Claude handles that naturally
- `npx snapview` zero-install — Electron binary too large for on-demand npx

## Context

- Shipped v1.0 with 2,149 LOC (TypeScript, JavaScript, CSS)
- Tech stack: Electron 35.7.5, electron-vite, TypeScript, bun test
- 76 tests across 6 test files, all passing
- 59 commits over 2 days (2026-03-16 → 2026-03-17)
- Claude Code already supports reading image files via the Read tool — injection mechanism proven and working
- Stop hook with dual signal detection (JSON parse + substring scan) for auto-trigger reliability
- Node.js hook script (not bash) for cross-platform Windows compatibility
- Postinstall with read-modify-write settings.json merge preserves existing Claude Code config

## Constraints

- **Size**: Electron adds ~50-80MB — acceptable for the cross-platform guarantee
- **Ephemerality**: Screenshots auto-cleaned; configurable via SNAPVIEW_RETENTION_HOURS (default 24h)
- **No OS dependencies**: Works out of the box without platform-specific tools
- **Install simplicity**: Single `npm i -g snapview` installs binary + registers skill + hooks
- **Startup speed**: Electron app launches overlay quickly

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Lightweight Electron for capture UI | Cross-platform screen capture without OS-specific tools | ✓ Good — works on Windows, macOS, Linux |
| File + Read tool for image injection | Simpler than MCP, leverages existing Claude Code capability | ✓ Good — proven end-to-end |
| OS temp directory for storage | Ephemeral by design, configurable cleanup | ✓ Good — no file accumulation |
| npm/bun global for distribution | Familiar JS ecosystem install, postinstall auto-registers | ✓ Good — one command experience |
| Hooks-based Claude Code integration | Enables auto-trigger via Stop hook, not just manual /snapview | ✓ Good — dual trigger works |
| Electron 35.7.5 pin | Avoid Linux cursor regression in v36+, v41.x too new | ✓ Good — stable across platforms |
| Node.js hook script (not bash) | Cross-platform; bash unavailable on some Windows setups | ✓ Good — works everywhere |
| Clipboard copy descoped from v1 | Electron clipboard.writeImage didn't paste correctly in testing | ⚠️ Revisit — investigate in v2 |

---
*Last updated: 2026-03-17 after v1.0 milestone*
