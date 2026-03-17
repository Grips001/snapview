# Snapview

## What This Is

A native screenshot capture tool for Claude Code that lets users instantly share what's on their screen with Claude. Instead of opening a separate screenshot app, saving a file, and dragging it in, users type `/snapview` (or Claude auto-triggers it) and get an overlay to select a screen region, preview it, and send it directly into the conversation. Built as a lightweight Electron app distributed via npm/bun with hooks-based Claude Code integration.

## Core Value

Users can share any part of their screen with Claude in under 3 seconds, without leaving the terminal workflow.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Screen capture overlay with drag-to-select region selection
- [ ] Preview window with approve/retake flow before sending
- [ ] Image injection into Claude Code session via temp file + Read tool
- [ ] Manual trigger via `/snapview` skill command
- [ ] Auto-trigger: Claude can request a screenshot and the capture UI launches automatically
- [ ] Ephemeral storage: screenshots saved to OS temp directory, auto-cleaned within 24 hours
- [ ] Cross-platform support (Windows, macOS, Linux) via lightweight Electron
- [ ] Simple installation via `npm i -g snapview` / `bun add -g snapview` and `npx snapview install`
- [ ] Hooks-based integration with Claude Code (not just a Skill.md)
- [ ] Bundled dependencies — install and use immediately, no external tools needed

### Out of Scope

- Screenshot annotation (arrows, boxes, text) — designed for future addition but not v1
- Video/screen recording — capture only, not streaming
- Cloud storage or sharing — images stay local
- Mobile/tablet support — desktop CLI tool only
- OCR or text extraction from screenshots — Claude handles that naturally

## Context

- Claude Code already supports reading image files via the Read tool, so the injection mechanism is proven
- Claude Code hooks system allows scripts to run in response to tool calls and events
- MCP servers can register tools, but file + Read is simpler and avoids protocol overhead
- The tool sits at the intersection of a Claude Code skill (markdown triggers), hooks (automation), and an external binary (Electron capture UI)
- Similar to the "gsd" tool pattern: a combination of markdown, hooks, and scripts delivering an integrated experience
- Primary user frustration: too many steps to show Claude something visual — this should feel instant

## Constraints

- **Size**: Electron adds ~50-80MB — acceptable for the cross-platform guarantee, but minimize bloat beyond that
- **Ephemerality**: Screenshots must not accumulate; OS temp dir with 24-hour max lifetime
- **No OS dependencies**: Must work out of the box without requiring users to install platform-specific tools
- **Install simplicity**: Single command to install, single command to set up Claude Code integration
- **Startup speed**: Electron app must launch and show overlay quickly (target <1 second)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Lightweight Electron for capture UI | Cross-platform screen capture without OS-specific tools; proven approach | — Pending |
| File + Read tool for image injection | Simpler than MCP, leverages existing Claude Code capability | — Pending |
| OS temp directory for storage | Ephemeral by design, auto-cleaned by OS, 24hr max via custom cleanup | — Pending |
| npm/bun global + npx for distribution | Familiar JS ecosystem install, npx for zero-commitment trial | — Pending |
| Hooks-based Claude Code integration | Enables auto-trigger (Claude requests screenshot), not just manual /snapview | — Pending |

---
*Last updated: 2026-03-16 after initialization*
