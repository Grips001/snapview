---
phase: 02-claude-code-integration
plan: 01
subsystem: claude-integration
tags: [skill, hooks, postinstall, claude-code]
dependency_graph:
  requires: []
  provides: [SKILL.md template, Stop hook script, postinstall install/uninstall]
  affects: [bin/snapview.cjs (Phase 02-02 will wire subcommands), package.json (Phase 02-02 will add postinstall script)]
tech_stack:
  added: []
  patterns: [read-modify-write JSON merge, Node.js Stop hook, skill registration via ~/.claude/skills/]
key_files:
  created:
    - claude-integration/SKILL.md
    - scripts/snapview-autotrigger.js
    - scripts/postinstall.cjs
  modified: []
decisions:
  - Node.js hook script (not bash) for cross-platform Windows compatibility per research Pitfall 5
  - Both JSON parse and substring scan for trigger detection — Claude may embed JSON signal in prose
  - Hook timeout 32s (execFileSync) under hook entry timeout 35s, both above Electron 30s hard-exit
  - Forward-slash path normalization in settings.json hook command for Windows per research Pitfall 4
  - Binary check via 'which'/'where' in addition to dir existence per research Pitfall 3
metrics:
  duration: 3min
  completed: 2026-03-17T14:33:08Z
  tasks_completed: 2
  files_created: 3
  files_modified: 0
---

# Phase 2 Plan 01: Claude Code Integration Artifacts Summary

**One-liner:** SKILL.md slash command template, Node.js Stop hook with dual-mode trigger detection, and postinstall read-modify-write settings merger for cross-platform Claude Code integration.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create SKILL.md template and Stop hook script | 8765af0 | claude-integration/SKILL.md, scripts/snapview-autotrigger.js |
| 2 | Create postinstall script with install and uninstall functions | 37f9844 | scripts/postinstall.cjs |

## Deliverables

### claude-integration/SKILL.md

Skill template installed to `~/.claude/skills/snapview/SKILL.md` by the postinstall script. Creates the `/snapview` global slash command in all Claude Code projects. Key frontmatter:
- `disable-model-invocation: true` — prevents Claude from auto-invoking on keyword detection
- `allowed-tools: Bash(snapview *)` — restricts tool usage to the snapview binary
- Step-by-step instructions for exit code handling (0=read file, 1=error, 2=cancelled, timeout)

### scripts/snapview-autotrigger.js

Node.js Stop hook script (not bash — cross-platform). Behavior:
1. Exits 0 silently if `SNAPVIEW_AUTO_TRIGGER !== '1'` (global toggle)
2. Parses Stop hook stdin JSON, extracts `last_assistant_message`
3. Detects `{"snapview_capture": true}` signal via JSON parse AND substring scan
4. Runs `snapview` binary via `execFileSync` with 32s timeout (buffer below 35s hook limit, above 30s Electron exit)
5. On success: outputs `{"decision":"block","reason":"Screenshot captured. Read the file at: <path>..."}`
6. On user cancel (exit 2): exits 0 silently (no block)
7. On error/timeout: outputs `{"decision":"block","reason":"Screenshot capture failed or timed out..."}`

### scripts/postinstall.cjs

CommonJS module with `install()` and `uninstall()` exports. Auto-runs `install()` when executed directly.

**install():**
- Detects Claude Code via `~/.claude/` dir OR `claude` binary in PATH (handles never-launched case)
- Copies SKILL.md template to `~/.claude/skills/snapview/SKILL.md`
- Copies hook script to `~/.claude/hooks/snapview-autotrigger.js`, sets chmod 755 on non-Windows
- Reads, merges, and writes `~/.claude/settings.json`: adds Stop hook entry with forward-slash path, sets `env.SNAPVIEW_AUTO_TRIGGER = '1'`
- Idempotent: filters existing snapview entry before pushing new one

**uninstall():**
- Removes `~/.claude/skills/snapview/` and `~/.claude/hooks/snapview-autotrigger.js`
- Cleans settings.json: removes snapview hook from Stop array, removes `SNAPVIEW_AUTO_TRIGGER` from env, prunes empty keys

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Node.js hook script (not bash) | Bash unavailable on Windows native (Pitfall 5 in research) |
| Dual trigger detection: JSON parse + substring scan | Claude may embed the JSON signal within prose text |
| Hook `execFileSync` timeout 32s, hook entry timeout 35s | Stack above Electron's 30s hard-exit, providing buffer at each layer |
| Forward-slash path normalization in settings.json | Windows backslashes invalid in JSON hook command path (Pitfall 4) |
| Check binary via `which`/`where` in addition to dir existence | `~/.claude/` created lazily on first launch (Pitfall 3) |
| `module.exports = { install, uninstall }` pattern | Enables Plan 02-02 to wire `snapview install`/`snapview uninstall` CLI subcommands |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- FOUND: claude-integration/SKILL.md
- FOUND: scripts/snapview-autotrigger.js
- FOUND: scripts/postinstall.cjs
- FOUND: commit 8765af0 (Task 1)
- FOUND: commit 37f9844 (Task 2)
