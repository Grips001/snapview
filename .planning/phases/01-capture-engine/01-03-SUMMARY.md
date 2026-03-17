---
phase: 01-capture-engine
plan: 03
subsystem: ui
tags: [electron, canvas, typescript, css, overlay, renderer]

# Dependency graph
requires:
  - phase: 01-02
    provides: preload bridge (window.snapviewBridge), index.html DOM structure, shared types
provides:
  - src/renderer/styles.css — complete CSS styling with all UI-SPEC custom properties
  - src/renderer/app.ts — canvas overlay state machine with drag-select, preview, approve/retake
affects: [02-claude-hook, any phase testing or extending the renderer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Canvas dim + clearRect cutout pattern for overlay selection rendering
    - State machine (selecting/previewing) via phase variable and CSS class toggle
    - All Electron IPC routed exclusively through window.snapviewBridge (contextBridge)
    - CSS custom properties for entire design system (no hard-coded values in rules)

key-files:
  created:
    - src/renderer/styles.css
    - src/renderer/app.ts
  modified: []

key-decisions:
  - "Click-without-drag (<5px) calls cancel() per UI-SPEC decision — avoids accidental full-screen capture"
  - "drawSelection uses clearRect + drawImage for selection cutout — simpler than clip/save/restore and produces clean brightness cutout"
  - "Canvas mouse listeners registered only after screenImage loads — prevents null dereference on early interaction"

patterns-established:
  - "Pattern: CSS custom properties declared in :root — all visual values via variables, no hard-coded colors in rules"
  - "Pattern: Canvas overlay state — drawDimOverlay() + clearRect() punch-through for selection region"
  - "Pattern: Renderer accesses Electron only via window.snapviewBridge — no direct electron import"

requirements-completed: [CAPT-01, CAPT-02, CAPT-03]

# Metrics
duration: 2min
completed: 2026-03-17
---

# Phase 1 Plan 03: Renderer UI Summary

**Canvas-based fullscreen overlay with dim + clearRect selection cutout, drag-to-select state machine, and centered preview panel with approve/retake flow all wired to the preload bridge**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-17T04:05:01Z
- **Completed:** 2026-03-17T04:07:05Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Complete CSS styling system for the overlay renderer using UI-SPEC custom properties verbatim
- Canvas state machine: selecting (drag-to-select with real-time cutout rendering) -> previewing (crop preview panel) -> approve or retake
- macOS permission denial dialog shown as modal over overlay, ESC cancellation from any state
- Full electron-vite build passes cleanly with all three targets (main, preload, renderer)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create renderer styles** - `facf981` (feat)
2. **Task 2: Create renderer application logic** - `3ef86a2` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/renderer/styles.css` — All CSS custom properties from UI-SPEC, overlay canvas, hint bar, preview panel, buttons, permission dialog
- `src/renderer/app.ts` — Full renderer logic: getSources init, canvas dim overlay, drag-to-select, mousedown/mousemove/mouseup handlers, selecting/previewing state machine, cropCanvas preview, approve/retake buttons, ESC keydown, permissionDenied modal

## Decisions Made

- Used `clearRect` + `drawImage` for selection cutout over clip/save/restore — simpler, produces the same brightness result with less code
- Canvas mouse listeners registered inside `img.onload` callback to guarantee `screenImage` is non-null before any rendering
- Click-without-drag threshold is `< 5px` in both axes (not just total distance) — avoids tiny accidental drags being treated as valid selections

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. Build passed on first attempt.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Renderer is complete and functional per UI-SPEC
- All three files wired together: index.html (DOM), styles.css (visual), app.ts (interaction)
- Ready for Phase 2: Claude hook integration — the captureRegion IPC call already emits file path to stdout which Phase 2 will consume

---
*Phase: 01-capture-engine*
*Completed: 2026-03-17*
