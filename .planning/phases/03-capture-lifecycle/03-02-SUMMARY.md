---
phase: 03-capture-lifecycle
plan: 02
subsystem: ui
tags: [electron, canvas, hidpi, devicePixelRatio, claude-integration]

# Dependency graph
requires:
  - phase: 01-capture-engine
    provides: overlay renderer (app.ts) with canvas-based screen capture UI
provides:
  - HiDPI-correct overlay canvas rendering (CSS pixel source coordinates)
  - Screenshot promotion instructions in SKILL.md for Claude to save important screenshots
affects: [future renderer changes, claude-integration skill usage]

# Tech tracking
tech-stack:
  added: []
  patterns: [CSS-pixel source coordinates for desktopCapturer thumbnails, screenshot promotion workflow]

key-files:
  created: []
  modified:
    - src/renderer/app.ts
    - claude-integration/SKILL.md

key-decisions:
  - "screenImage source coords use CSS pixels (not physical pixels) — thumbnailSize is set to display.size CSS values, so * dpr multiplication overshoots the image on HiDPI"
  - "Crop canvas destination remains at physical pixels (width * dpr) for quality preview output"
  - "Screenshot promotion is opt-in by Claude assessment; user override always honored"

patterns-established:
  - "drawImage source coords: no dpr multiplication when thumbnail was sized at CSS pixels"
  - "Screenshot promotion: mkdir -p ./screenshots && cp pattern with descriptive filenames"

requirements-completed: [INTG-05]

# Metrics
duration: 2min
completed: 2026-03-17
---

# Phase 03 Plan 02: HiDPI Fix and Screenshot Promotion Summary

**Fixed canvas source coordinate overflow on HiDPI displays (CSS pixel thumbnails, not physical) and added Claude screenshot promotion workflow to SKILL.md**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-17T15:56:21Z
- **Completed:** 2026-03-17T15:58:12Z
- **Tasks:** 2 of 3 complete (Task 3 is checkpoint:human-verify, awaiting user)
- **Files modified:** 2

## Accomplishments
- Fixed HiDPI zoom artifact: drawSelection() and transitionToPreviewing() now use CSS pixel source coordinates matching the actual screenImage resolution
- Updated comments in app.ts to accurately describe the coordinate space
- Added Screenshot Promotion section to SKILL.md with offer/stay-quiet guidance, promotion command pattern, and descriptive filename convention
- Build passes (electron-vite), all 80 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix HiDPI overlay canvas rendering** - `ac18e71` (fix)
2. **Task 2: Add screenshot promotion instructions to SKILL.md** - `7cd15be` (feat)
3. **Task 3: Visual verification checkpoint** - awaiting user verification

## Files Created/Modified
- `src/renderer/app.ts` - Fixed two drawImage source coord bugs; updated comments to say "CSS pixels"
- `claude-integration/SKILL.md` - Added Screenshot Promotion section (15 lines appended after step 6)

## Decisions Made
- screenImage source coordinates must NOT be multiplied by dpr because desktopCapturer thumbnailSize was set to `activeDisplay.size` (CSS pixels), not physical pixel dimensions
- Crop canvas destination remains `width * dpr` because the backing buffer is sized at physical pixels for quality output — only the source is at CSS pixels
- Screenshot promotion is Claude-assessed (quiet for throwaway, offer for important), with user override always honored

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- HiDPI rendering fix is live; overlay should now match screen content on Retina/HiDPI displays
- SKILL.md promotion workflow ready for use in any Claude Code session with snapview installed
- Awaiting user verification (Task 3 checkpoint) to confirm visual and clipboard behavior

---
*Phase: 03-capture-lifecycle*
*Completed: 2026-03-17*

## Self-Check: PASSED

- src/renderer/app.ts: FOUND
- claude-integration/SKILL.md: FOUND
- 03-02-SUMMARY.md: FOUND
- Commit ac18e71: FOUND
- Commit 7cd15be: FOUND
