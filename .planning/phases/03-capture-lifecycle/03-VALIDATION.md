---
phase: 3
slug: capture-lifecycle
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bun test (built-in, used in Phase 1 and 2) |
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
| TBD | TBD | TBD | FILE-02 | unit | `bun test src/main/cleanup.test.ts` | ✅ (exists from P1) | ⬜ pending |
| TBD | TBD | TBD | FILE-03 | unit | `bun test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | INTG-05 | manual | N/A (SKILL.md content) | N/A | ⬜ pending |
| TBD | TBD | TBD | HiDPI | visual | Manual verification | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Extend `src/main/cleanup.test.ts` — add test for env var retention configuration
- [ ] Add clipboard test stubs (may require Electron mock or integration test)

*Existing Phase 1 test infrastructure (bun test, tsconfig) covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Clipboard copy pastes correctly | FILE-03 | Requires GUI clipboard + paste app | 1. Run snapview 2. Capture region 3. Open image editor 4. Ctrl+V 5. Verify image appears |
| HiDPI overlay renders correctly | HiDPI fix | Requires HiDPI display | 1. Run on Retina/HiDPI display 2. Verify overlay matches actual screen (no zoom) |
| Screenshot promotion via Claude | INTG-05 | Requires live Claude Code session | 1. Capture screenshot 2. Ask Claude to save it 3. Verify file in ./screenshots/ with descriptive name |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
