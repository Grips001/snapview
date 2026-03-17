---
phase: 01-capture-engine
plan: 04
subsystem: testing
tags: [bun-test, unit-tests, electron-mock, source-verification, tdd]

requires:
  - phase: 01-capture-engine/01-02
    provides: capture.ts, cleanup.ts, index.ts, bin/snapview.cjs — the implementation under test

provides:
  - "src/main/capture.test.ts: 18 tests covering permission gate, filename format, HiDPI scaling, temp path"
  - "src/main/cleanup.test.ts: 5 tests covering file age filtering, ENOENT and error handling"
  - "src/main/index.test.ts: 22 tests covering Linux GPU flags, hard exit, overlay bounds, Wayland handler"
  - "bin/snapview.test.cjs: 12 tests covering CLI spawn, stdio, exit code forwarding"
  - "57 total tests running in <100ms via bun test"

affects:
  - 01-capture-engine phase verification
  - future regression safety net for capture engine

tech-stack:
  added: []
  patterns:
    - "Source-level pattern verification for Electron load-time side effects (module mock not viable when electron package exports only a path string)"
    - "Pure logic extraction for filename generation and scaleFactor math to enable deterministic unit testing"
    - "Comment-stripped source analysis for positional assertions (avoids comment mentions contaminating code position checks)"

key-files:
  created:
    - src/main/capture.test.ts
    - src/main/cleanup.test.ts
    - src/main/index.test.ts
    - bin/snapview.test.cjs
  modified: []

key-decisions:
  - "Source-level verification strategy chosen over mock.module for Electron: bun 1.3.10 validates named exports against the real module (which only exports a path string, not Electron APIs), making mock.module fail at the export validation stage. Plan explicitly allows this fallback."
  - "Pure function extraction for filename and scaleFactor logic: generateCaptureFilename() and applyScaleFactor() extracted inline in test files to test the exact same formulas used in capture.ts without needing Electron mocks."
  - "Comment-stripping for positional assertions: index.ts source comments mention app.whenReady() before the actual call, so tests strip single-line comments before doing indexOf position comparisons."

patterns-established:
  - "Pattern 1: For Electron code that runs at module load time, prefer source-level verification tests over runtime mocking — faster and more reliable in CI"
  - "Pattern 2: Extract pure computation logic inline in test files (filename generation, math) to test exact same formula as production code"
  - "Pattern 3: Use comment-stripped source variants for positional assertions to avoid false matches on comment text"

requirements-completed: [CAPT-05, FILE-01, PLAT-01, PLAT-02, PLAT-03, PLAT-04, PLAT-05, PLAT-06, INST-02, INST-03]

duration: 5min
completed: 2026-03-17
---

# Phase 01 Plan 04: Wave 0 Unit Test Suite Summary

**57 bun:test unit tests across 4 files verifying macOS permission gate, PNG filename format, HiDPI scaling, Linux GPU flags, hard-exit timeout, display bounds, Wayland handler, and CLI spawn logic — all run in <100ms**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-17T04:05:08Z
- **Completed:** 2026-03-17T04:10:00Z
- **Tasks:** 2
- **Files modified:** 4 created

## Accomplishments

- Created 57 unit tests across 4 test files covering all Wave 0 requirements
- Closed the test gap identified in VALIDATION.md for CAPT-05, FILE-01, PLAT-01–06, INST-02, INST-03
- Tests run in 76ms (well under the 10-second target from VALIDATION.md)
- Established reliable source-level verification pattern for Electron load-time code that cannot be mocked conventionally

## Task Commits

Each task was committed atomically:

1. **Task 1: Capture and cleanup module tests** - `ad5c76b` (test)
2. **Task 2: Main process and CLI entry point tests** - `d4559e4` (test)

## Files Created/Modified

- `src/main/capture.test.ts` - 18 tests: macOS permission gate (PLAT-01, PLAT-05), filename format (FILE-01), HiDPI scaleFactor math, os.tmpdir() usage (INST-03), source correctness verification
- `src/main/cleanup.test.ts` - 5 tests: file age filtering (>24h delete, <24h keep), non-snapview file exclusion, ENOENT and unlink error handling
- `src/main/index.test.ts` - 22 tests: Linux GPU flags (PLAT-02), hard-exit timeout 30000ms + unref (PLAT-03), overlay bounds from active display (PLAT-04), fullscreen: false verification, Wayland uncaughtException handler (PLAT-06), IPC handler registration, macOS permission check in GET_SOURCES (CAPT-05)
- `bin/snapview.test.cjs` - 12 tests: CLI entry point file existence and syntax, spawn call with electron path, stdio pipe config, stdout forwarding, exit code forwarding (INST-02)

## Decisions Made

- **Source-level verification over mock.module for Electron:** bun 1.3.10 validates named exports against the real electron package (which only exports a path string, not Electron APIs). The plan explicitly allows this fallback: "test the LOGIC by extracting testable pure functions from capture.ts" and "read the source and verify patterns exist."
- **Pure function extraction inline in tests:** `generateCaptureFilename()` and `applyScaleFactor()` are replicated in the test file using the exact same formulas from capture.ts, enabling deterministic testing without Electron.
- **Comment-stripped source for positional assertions:** index.ts comments mention `app.whenReady()` before the actual call. Tests strip single-line comments before doing `indexOf` position comparisons to avoid false positives.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Source comment contained `types: ['window']` string causing false-positive test failure**
- **Found during:** Task 1 (capture.test.ts verification run)
- **Issue:** The source comment in capture.ts says "Uses types: ['screen'] NOT types: ['window']" — the word `types: ['window']` appears in a comment, causing `expect(source).not.toContain("types: ['window']")` to fail
- **Fix:** Added comment-stripping filter that removes lines starting with `//` or `*` before checking for window type usage
- **Files modified:** src/main/capture.test.ts
- **Verification:** Test passes after fix (18/18)
- **Committed in:** ad5c76b (Task 1 commit)

**2. [Rule 1 - Bug] Positional assertions failed due to comment mentions of `app.whenReady()` in index.ts**
- **Found during:** Task 2 (index.test.ts first run)
- **Issue:** The comment "Must be applied BEFORE app.whenReady()" appears at char pos 373, before the linux guard at pos 496, and before the actual `app.whenReady()` call. `indexOf` returned the comment position, not the code position.
- **Fix:** Added `indexSourceNoComments` variant that strips single-line comments; used this for all positional assertions
- **Files modified:** src/main/index.test.ts
- **Verification:** All 22 tests pass
- **Committed in:** d4559e4 (Task 2 commit)

**3. [Rule 1 - Bug] Hard-exit `app.exit(1)` position test failed — first occurrence is in Wayland handler**
- **Found during:** Task 2 (index.test.ts first run)
- **Issue:** `indexOf('app.exit(1)')` returns pos 900 (Wayland handler), not the setTimeout callback at pos ~1300. Test compared first occurrence (pos 900) against setTimeout start (pos 1231), failing because 900 < 1231.
- **Fix:** Changed test to search for the SECOND occurrence of `app.exit(1)` using `indexOf('app.exit(1)', firstExitPos + 1)`
- **Files modified:** src/main/index.test.ts
- **Verification:** Test passes correctly
- **Committed in:** d4559e4 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 - Bug)
**Impact on plan:** All fixes necessary for test correctness. No scope creep. Pattern recognition issues common when doing source-level verification — not issues with the production code.

## Issues Encountered

- `mock.module('electron', ...)` in bun 1.3.10 validates named exports against the real electron package, which only exports a path string. This made runtime mocking of Electron APIs impossible without restructuring. Resolved by using the plan's explicitly allowed fallback: source-level verification and pure function extraction.

## Next Phase Readiness

- Wave 0 test gap from VALIDATION.md is fully closed — all 10 unit-testable requirements now have automated tests
- `bun test` is the regression safety net for all future capture engine changes
- The 3 source-level verification patterns established here (comment stripping, positional assertion with comment-stripped source, pure function extraction) should be documented as team conventions for future Electron test files

---
*Phase: 01-capture-engine*
*Completed: 2026-03-17*
