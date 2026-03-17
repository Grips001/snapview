---
phase: 2
slug: claude-code-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bun test (built-in, used in Phase 1) |
| **Config file** | package.json (`"test": "bun test"`) |
| **Quick run command** | `bun test` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test`
- **After every plan wave:** Run `bun test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | INTG-01 | integration | `bun test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | INTG-02 | integration | `bun test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | INTG-03 | integration | `bun test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | INTG-04 | integration | `bun test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | INST-01 | integration | `bun test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/cli/install.test.ts` — stubs for INST-01 (install/uninstall registration)
- [ ] `src/cli/cli.test.ts` — stubs for INTG-04 (CLI subcommand routing)
- [ ] Hook script tests — stubs for INTG-02 (auto-trigger signal handling)

*Existing Phase 1 test infrastructure (bun test, tsconfig) covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| /snapview launches capture UI in Claude Code | INTG-01 | Requires live Claude Code session | 1. Open Claude Code session 2. Type /snapview 3. Verify overlay appears 4. Capture region 5. Verify screenshot appears in context |
| Auto-trigger fires from Claude's signal | INTG-02 | Requires live Claude Code session with hooks | 1. Ask Claude to look at something on screen 2. Verify capture UI launches 3. Verify screenshot returns to context |
| Global install registers in ~/.claude/ | INTG-03 | Requires real ~/.claude/ directory | 1. npm i -g snapview 2. Check ~/.claude/skills/snapview/SKILL.md exists 3. Check ~/.claude/settings.json has hook entries |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
