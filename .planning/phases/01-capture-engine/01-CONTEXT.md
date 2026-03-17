# Phase 1: Capture Engine - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Cross-platform Electron app that captures a user-selected screen region via a fullscreen dimmed overlay, shows a preview with approve/retake, and writes the PNG to the OS temp directory. All platform safety guards (macOS permissions, Linux GPU flags, multi-monitor, hard-exit timeout) are baked in here. This phase delivers a working `snapview` CLI command that outputs a file path to stdout — Claude Code integration comes in Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Overlay interaction
- Medium dim (40-50%) — macOS-style subtle darkening, not heavy Windows Snipping Tool contrast
- Selected region shows as a clear cutout at full brightness with a subtle border around the edge for precision
- No live dimension tooltip during drag — keep the overlay clean
- Small instructional hint text: "Drag to select / ESC to cancel" — visible but unobtrusive
- Overlay covers the active monitor only (where cursor is at launch), not all monitors
- No resize handles after selection — mouse-up commits the selection, retake from preview if wrong

### Preview experience
- Claude's discretion: window placement (center vs in-place), button labels/style, keyboard shortcuts, image scaling approach
- Must include approve and retake options — exact UX is flexible

### Stdout contract
- Claude's discretion: output format (path vs JSON), exit codes on cancel vs error, stderr logging behavior, CLI flags for Phase 1
- Key constraint: stdout must be cleanly parseable by hooks/scripts — no mixed human/machine output on stdout

### Project structure
- Follow latest documented best practices for electron-vite and Claude Code plugin projects — researcher should verify current conventions
- npm package name: `snapview`
- Claude's discretion: TypeScript vs JS split, license choice, directory layout specifics

### Claude's Discretion
- Cursor style during selection (standard crosshair vs custom full-screen crosshair)
- Click-without-drag behavior (cancel vs capture full screen)
- Preview window placement and button design
- Keyboard shortcut assignments in preview
- Image scaling in preview (fit-to-window vs actual size)
- Stdout output format and exit code conventions
- Stderr logging strategy
- CLI flags for Phase 1
- macOS permission denial UX (dialog vs toast)
- Selection border color/style
- TypeScript configuration
- License (default to MIT per JS ecosystem convention)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research findings
- `.planning/research/STACK.md` — Recommended technology stack with specific versions and rationale
- `.planning/research/ARCHITECTURE.md` — Component boundaries, data flow, and build order
- `.planning/research/PITFALLS.md` — Critical platform pitfalls with prevention strategies
- `.planning/research/SUMMARY.md` — Synthesized research with phase-specific implications

### Project context
- `.planning/PROJECT.md` — Core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — Phase 1 requirements: CAPT-01..05, FILE-01, PLAT-01..06, INST-02, INST-03
- `.planning/ROADMAP.md` — Phase 1 goal and success criteria

### External references (researcher should verify latest)
- Electron desktopCapturer API docs — capture mechanics, platform limitations
- Electron BrowserWindow transparent/fullscreen configuration
- electron-vite project structure conventions
- Claude Code hooks and skills documentation — for understanding the downstream integration contract

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None yet — Phase 1 establishes all patterns (electron-vite structure, IPC conventions, file output contract)

### Integration Points
- stdout is the integration point for Phase 2 — whatever contract Phase 1 establishes for output, Phase 2 hooks will consume it
- File path convention in `os.tmpdir()/snapview/` is consumed by Phase 2 (Read tool injection) and Phase 3 (cleanup, clipboard)

</code_context>

<specifics>
## Specific Ideas

- User emphasized keeping the overlay clean — no clutter, no unnecessary UI elements
- "We are not recreating the snipping tool" — speed and simplicity over feature completeness
- macOS-style medium dim preferred over heavy Windows Snipping Tool dim
- Active monitor only for multi-monitor — don't overwhelm with overlay on all screens
- Follow documented best practices rather than inventing patterns — research latest conventions for electron-vite and Claude Code plugins

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-capture-engine*
*Context gathered: 2026-03-16*
