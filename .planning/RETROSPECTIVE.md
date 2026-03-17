# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-17
**Phases:** 3 | **Plans:** 10 | **Commits:** 59

### What Was Built
- Cross-platform screen capture engine (Electron 35.7.5) with drag-to-select overlay and preview
- `/snapview` Claude Code skill command with auto-read screenshot injection
- Stop hook auto-trigger so Claude can request screenshots programmatically
- One-command global install (`npm i -g snapview`) with skill + hooks auto-registration
- Configurable auto-cleanup (SNAPVIEW_RETENTION_HOURS env var)
- Screenshot promotion to project directory via Claude judgment
- HiDPI/Retina display rendering fix
- 76 tests across 6 test files

### What Worked
- Two-day delivery from project init to shipped milestone — aggressive but achievable scope
- Parallel wave execution in Phase 3 (two plans in Wave 1) saved time
- Research phase correctly identified the Stop hook as the right auto-trigger mechanism (not UserPromptSubmit)
- Phase 1's exit code convention (0/1/2) made Phase 2 hook integration seamless
- TDD approach caught env-var retention edge cases that would have been missed
- User-driven discuss-phase sessions captured real preferences (e.g., bare `/snapview`, no keyword auto-launch)

### What Was Inefficient
- FILE-03 (clipboard copy) was fully implemented then reverted — wasted one plan task. Could have been validated earlier with a quick manual test before writing the code
- HiDPI bug deferred from Phase 1 to Phase 3 — could have been caught in Phase 1 if testing had included a HiDPI display check
- Nyquist VALIDATION.md frontmatter never updated to compliant during execution — documentation gap across all 3 phases

### Patterns Established
- Node.js hook scripts (not bash) for cross-platform Claude Code integration
- Subcommand routing before `require('electron')` for fast CLI paths (install/uninstall)
- Child-process spawn with HOME/USERPROFILE override for test isolation
- Read-modify-write merge pattern for `~/.claude/settings.json`
- Source-level verification tests for Electron APIs that can't be unit-tested

### Key Lessons
1. Test clipboard/platform features manually before implementing — automated tests can pass while the feature doesn't work as expected
2. Pin Electron versions explicitly — upstream regressions (cursor bugs in v36+) can waste significant debug time
3. Claude Code hooks documentation should be fetched fresh per phase — the API surface evolves and assumptions from research can be stale
4. Descoping is better than shipping broken — FILE-03 clipboard copy was the right call to remove

### Cost Observations
- Model mix: ~60% sonnet (research, verification, execution), ~40% opus (planning, orchestration)
- Sessions: ~5 conversation turns across discuss/plan/execute per phase
- Notable: Parallel agent execution in waves significantly reduced wall-clock time

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.0 | 59 | 3 | Initial project — established all patterns |

### Cumulative Quality

| Milestone | Tests | LOC | Zero-Dep Additions |
|-----------|-------|-----|-------------------|
| v1.0 | 76 | 2,149 | 0 (Electron only external dep) |

### Top Lessons (Verified Across Milestones)

1. Manual validation of platform features before coding prevents wasted implementation effort
2. Pinning dependencies with known-good versions prevents upstream regression debugging
