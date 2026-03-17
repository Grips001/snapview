---
phase: 03-capture-lifecycle
plan: "01"
subsystem: main-process
tags: [cleanup, capture, clipboard, env-var, file-management]
dependency_graph:
  requires: []
  provides: [FILE-02, FILE-03]
  affects: [src/main/cleanup.ts, src/main/capture.ts]
tech_stack:
  added: []
  patterns: [env-var-with-parseFloat-fallback, try-catch-non-fatal-side-effect, source-level-test-verification]
key_files:
  created: []
  modified:
    - src/main/cleanup.ts
    - src/main/cleanup.test.ts
    - src/main/capture.ts
    - src/main/capture.test.ts
decisions:
  - "SNAPVIEW_RETENTION_HOURS read inside function body (not module level) so tests can set process.env before calling without module re-import"
  - "clipboard.writeImage wrapped in try/catch so clipboard failure never prevents file write or CaptureResult return"
  - "Source-level verification strategy used for capture.ts clipboard tests — same approach as FILE-01 tests"
metrics:
  duration: "~8min"
  completed_date: "2026-03-17"
  tasks: 2
  files_modified: 4
---

# Phase 03 Plan 01: Capture Lifecycle Improvements Summary

**One-liner:** Env-var configurable retention via `SNAPVIEW_RETENTION_HOURS` with `parseFloat || 24` fallback, plus non-fatal `clipboard.writeImage(cropped)` in try/catch before `toPNG()` in `captureRegion()`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for SNAPVIEW_RETENTION_HOURS | 8cc54b5 | src/main/cleanup.test.ts |
| 1 (GREEN) | Env-var configurable cleanup retention (FILE-02) | 2b8edf3 | src/main/cleanup.ts |
| 2 | Auto clipboard copy on capture (FILE-03) | b0991a8 | src/main/capture.ts, src/main/capture.test.ts |

## What Was Built

### Task 1: Env-var configurable cleanup retention (FILE-02)

**cleanup.ts changes:**
- Removed module-level `TWENTY_FOUR_HOURS_MS` constant
- Added inside `sweepOldCaptures()` function body:
  ```typescript
  const retentionHours = parseFloat(process.env.SNAPVIEW_RETENTION_HOURS ?? '') || 24;
  const retentionMs = retentionHours * 60 * 60 * 1000;
  ```
- Age comparison now uses `retentionMs` instead of `TWENTY_FOUR_HOURS_MS`

**cleanup.test.ts additions (4 new tests):**
- `uses SNAPVIEW_RETENTION_HOURS env var for retention window` — custom 1h retention, 2h-old file deleted
- `defaults to 24 hours when SNAPVIEW_RETENTION_HOURS is not set` — 23h-old file preserved
- `defaults to 24 hours when SNAPVIEW_RETENTION_HOURS is empty string` — 25h-old file deleted
- `defaults to 24 hours when SNAPVIEW_RETENTION_HOURS is invalid` — 25h-old file deleted (fallback)

### Task 2: Auto clipboard copy on capture (FILE-03)

**capture.ts changes:**
- Added `clipboard` to electron import
- Inserted try/catch wrapping `clipboard.writeImage(cropped)` between the `crop()` call and `toPNG()`:
  ```typescript
  // Auto-copy to clipboard (FILE-03) — non-fatal; capture must succeed regardless
  try {
    clipboard.writeImage(cropped);
  } catch (err) {
    console.error('[snapview] clipboard.writeImage failed (non-fatal):', (err as Error).message);
  }
  ```

**capture.test.ts additions (4 new source-level verification tests):**
- `imports clipboard from electron` — regex validates named import
- `calls clipboard.writeImage(cropped) after crop` — string containment check
- `wraps clipboard.writeImage in try/catch (non-fatal)` — positional: try < writeImage < catch
- `clipboard failure does not prevent file write` — positional: writeImage < toPNG()

## Verification

```
bun test src/main/cleanup.test.ts   → 9 pass, 0 fail
bun test src/main/capture.test.ts   → 22 pass, 0 fail
bun test                             → 80 pass, 0 fail
```

## Deviations from Plan

None — plan executed exactly as written.

## Decisions Made

1. `SNAPVIEW_RETENTION_HOURS` is parsed inside the function body (not at module load time) so tests can inject env var values without module re-import workarounds.
2. Clipboard write is wrapped in a plain try/catch (not async — `writeImage` is synchronous in Electron). Failure logs a console.error but never throws, preserving `captureRegion()` success invariant.
3. Source-level test verification used for clipboard pattern (same strategy as existing FILE-01 tests) — avoids Electron mock complexity in bun test environment.

## Self-Check: PASSED

- src/main/cleanup.ts: FOUND
- src/main/capture.ts: FOUND
- src/main/cleanup.test.ts: FOUND
- src/main/capture.test.ts: FOUND
- Commit 8cc54b5 (RED - cleanup tests): FOUND
- Commit 2b8edf3 (feat - cleanup impl): FOUND
- Commit b0991a8 (feat - clipboard): FOUND
