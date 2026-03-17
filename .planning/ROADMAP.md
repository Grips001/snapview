# Roadmap: Snapview

## Overview

Snapview ships in three phases. Phase 1 builds the cross-platform capture engine — the Electron app that overlays the screen, captures a user-selected region, and writes a PNG to the OS temp directory. All platform-specific risks (macOS permissions, Linux GPU flags, multi-monitor, hook hang prevention) are baked in here because they are architectural decisions, not patches. Phase 2 wires the capture engine into Claude Code — the `/snapview` skill command, the hooks-based auto-trigger, and the global install command that registers both in `~/.claude/` in one step. Phase 3 completes the capture lifecycle — auto-cleanup of old screenshots, clipboard copy alongside injection, and the ability to promote a screenshot to the project directory for long-term reference.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Capture Engine** - Working cross-platform screen region capture with preview, temp file output, and all platform safety guards
- [ ] **Phase 2: Claude Code Integration** - `/snapview` skill command, hooks-based auto-trigger, and one-command global install
- [ ] **Phase 3: Capture Lifecycle** - Auto-cleanup, clipboard copy, and screenshot promotion to project directory

## Phase Details

### Phase 1: Capture Engine
**Goal**: Users can launch a screen region selector, preview the capture, and have the screenshot written as a PNG to the OS temp directory — reliably on Windows, macOS, and Linux with no external tools required
**Depends on**: Nothing (first phase)
**Requirements**: CAPT-01, CAPT-02, CAPT-03, CAPT-04, CAPT-05, FILE-01, PLAT-01, PLAT-02, PLAT-03, PLAT-04, PLAT-05, PLAT-06, INST-02, INST-03
**Success Criteria** (what must be TRUE):
  1. User runs `snapview` from any terminal and a fullscreen dimmed overlay appears with a crosshair cursor within 1 second
  2. User drags to select a screen region, sees a preview, and can approve or retake before any file is written
  3. User presses ESC at any point and the overlay closes cleanly — no orphaned processes, no hung terminal
  4. Approved capture is saved as a PNG at `os.tmpdir()/snapview/snapview-{timestamp}-{random}.png` and the path is printed to stdout
  5. The tool works without installing any OS-level dependencies on Windows, macOS, and Linux (X11)
**Plans:** 5/5 plans executed

Plans:
- [x] 01-01-PLAN.md — Project scaffold, configs, shared types, CLI entry point
- [x] 01-02-PLAN.md — Main process, capture engine, cleanup, preload bridge
- [x] 01-03-PLAN.md — Renderer UI — overlay canvas, selection, preview panel
- [x] 01-04-PLAN.md — Unit test suite for main process and CLI
- [x] 01-05-PLAN.md — Build verification and manual integration checkpoint

### Phase 2: Claude Code Integration
**Goal**: Users can trigger a screenshot from inside Claude Code via `/snapview`, Claude can auto-request a screenshot via hooks, and `npm i -g snapview` both installs the binary and configures the Claude Code skill and hooks in one step
**Depends on**: Phase 1
**Requirements**: INTG-01, INTG-02, INTG-03, INTG-04, INST-01
**Success Criteria** (what must be TRUE):
  1. User types `/snapview` in a Claude Code session, the capture UI launches, and the screenshot is injected into Claude's context automatically
  2. Claude can emit a structured signal that auto-triggers the capture UI and receives the screenshot path without user typing any command
  3. Running `npm i -g snapview` installs the binary and registers the skill and hooks in `~/.claude/` — available in all Claude Code projects with no further setup
  4. If the Electron process stalls or crashes, the Claude Code hook exits cleanly within 30 seconds rather than hanging the session indefinitely
**Plans:** 3 plans

Plans:
- [ ] 02-01-PLAN.md — SKILL.md template, Stop hook script, and postinstall registration logic
- [ ] 02-02-PLAN.md — CLI install/uninstall subcommands, package.json postinstall, and unit tests
- [ ] 02-03-PLAN.md — Build verification and integration checkpoint

### Phase 3: Capture Lifecycle
**Goal**: Screenshots are cleaned up automatically, copied to clipboard when captured, and users can choose to keep an important screenshot in the project directory rather than letting it expire with the temp files
**Depends on**: Phase 2
**Requirements**: FILE-02, FILE-03, INTG-05
**Success Criteria** (what must be TRUE):
  1. Screenshots older than 24 hours are automatically deleted from the temp directory on the next launch — the temp directory does not accumulate files over time
  2. Every approved capture is automatically copied to the system clipboard alongside being injected into Claude
  3. Claude can offer to copy a screenshot to the current project directory, and when accepted, the file persists beyond the 24-hour temp window
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Capture Engine | 5/5 | Complete | 2026-03-17 |
| 2. Claude Code Integration | 0/3 | Planning complete | - |
| 3. Capture Lifecycle | 0/TBD | Not started | - |
