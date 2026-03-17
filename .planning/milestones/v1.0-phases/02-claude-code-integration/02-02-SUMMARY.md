---
phase: 02-claude-code-integration
plan: 02
subsystem: cli-registration
tags: [cli, postinstall, testing, bun-test, tdd]
dependency_graph:
  requires: [02-01]
  provides: [INST-01]
  affects: [bin/snapview.cjs, package.json, scripts/]
tech_stack:
  added: []
  patterns: [child-process-spawn-with-env-override, tdd-integration-tests]
key_files:
  created:
    - scripts/postinstall.test.ts
    - scripts/snapview-autotrigger.test.ts
  modified:
    - bin/snapview.cjs
    - package.json
decisions:
  - Subcommand routing checks args[0] before require('electron') to avoid heavy Electron load for install/uninstall
  - Test isolation via HOME/USERPROFILE env override in child processes (not mock.module) — CJS module-level constants prevent in-process mocking
  - Mock snapview binary uses .cmd wrapper on Windows, sh script on Unix for cross-platform test compatibility
metrics:
  duration: 3min
  completed: 2026-03-17
  tasks: 2
  files_changed: 4
---

# Phase 02 Plan 02: CLI Wiring and Unit Tests Summary

**One-liner:** CLI install/uninstall subcommands wired to postinstall.cjs, package.json postinstall added for auto-registration on global install, with 15 unit tests covering file creation, settings merge, idempotency, and hook signal detection.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add install/uninstall subcommands to CLI and postinstall to package.json | c8828f7 | bin/snapview.cjs, package.json |
| 2 | Create unit tests for postinstall and hook script | 55fab54 | scripts/postinstall.test.ts, scripts/snapview-autotrigger.test.ts |

## What Was Built

### Task 1: CLI Subcommand Routing

Modified `bin/snapview.cjs` to check `process.argv[2]` for `install`/`uninstall` before loading Electron. This keeps the Electron binary out of memory for management commands.

Key change: `args` is now extracted once at the top and reused when passing to the Electron spawn — functionally identical to `process.argv.slice(2)` but avoids repeating the slice call.

Added `"postinstall": "node scripts/postinstall.cjs"` to `package.json` so `npm i -g snapview` or `bun add -g snapview` automatically runs the skill and hook registration.

### Task 2: Unit Tests (TDD)

**postinstall.test.ts** (10 tests):
- install() creates SKILL.md with correct template content
- install() creates hooks/snapview-autotrigger.js
- install() creates settings.json with Stop hook entry
- install() sets SNAPVIEW_AUTO_TRIGGER=1 in env
- install() preserves existing settings.json entries (UserPromptSubmit hook survives)
- install() is idempotent — exactly one snapview entry after running twice
- uninstall() removes skills/snapview/ directory
- uninstall() removes hooks/snapview-autotrigger.js
- uninstall() removes snapview hook from Stop array
- uninstall() preserves non-snapview entries

**snapview-autotrigger.test.ts** (5 tests):
- Exits 0 silently when SNAPVIEW_AUTO_TRIGGER not set (even with trigger in message)
- Exits 0 silently when no trigger signal in message
- Outputs decision:block JSON on snapview_capture signal (with mock snapview binary)
- Exits 0 silently on exit code 2 (user cancel)
- Outputs decision:block with failure message on exit code 1 (error)

## Verification Results

```
bun test scripts/ → 15 pass, 0 fail
node -c bin/snapview.cjs → syntax OK
grep "postinstall" package.json → "postinstall": "node scripts/postinstall.cjs"
grep "require.*postinstall" bin/snapview.cjs → require found
```

## Deviations from Plan

**None** — plan executed exactly as written. Tests passed immediately (GREEN from start) because the implementation from Plan 01 was already correct. The TDD flow was followed: test files written first, then verified green against the existing implementation.

## Decisions Made

1. **Subcommand routing before Electron load** — `install`/`uninstall` handled by checking `args[0]` before `require('electron')`. Avoids loading the heavy Electron binary for management commands.

2. **Child-process spawn for test isolation** — `postinstall.cjs` uses `os.homedir()` at module-load time (constant), so in-process mocking is not viable. Tests spawn node child processes with `HOME`/`USERPROFILE` overridden to a temp directory for isolation.

3. **Cross-platform mock binary** — Windows mock uses a `.cmd` wrapper calling a `.js` file; Unix uses a `sh` script. Ensures autotrigger tests work on both platforms.

## Self-Check

Files verified:
- scripts/postinstall.test.ts: FOUND
- scripts/snapview-autotrigger.test.ts: FOUND
- bin/snapview.cjs (modified): FOUND

Commits verified:
- c8828f7: feat(02-02): add install/uninstall subcommands to CLI and postinstall to package.json
- 55fab54: test(02-02): add unit tests for postinstall and hook script
