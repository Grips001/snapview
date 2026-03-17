---
phase: 1
slug: capture-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bun:test (built into Bun — no additional install) |
| **Config file** | None required — `bun test` discovers `*.test.ts` files |
| **Quick run command** | `bun test` |
| **Full suite command** | `bun test --coverage` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test`
- **After every plan wave:** Run `bun test --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 0 | CAPT-05 | unit | `bun test src/main/capture.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 0 | FILE-01 | unit | `bun test src/main/capture.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 0 | PLAT-01 | unit | `bun test src/main/capture.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 0 | PLAT-05 | unit | `bun test src/main/capture.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 0 | PLAT-03 | unit | `bun test src/main/index.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 0 | PLAT-02 | unit | `bun test src/main/index.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 0 | PLAT-04 | unit | `bun test src/main/index.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 0 | PLAT-06 | unit | `bun test src/main/index.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 0 | INST-02 | unit | `bun test bin/snapview.test.cjs` | ❌ W0 | ⬜ pending |
| TBD | 01 | 0 | INST-03 | unit | `bun test src/main/capture.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | — | CAPT-01 | manual | Manual — requires display | ❌ Manual | ⬜ pending |
| TBD | 01 | — | CAPT-02 | manual | Manual — requires display | ❌ Manual | ⬜ pending |
| TBD | 01 | — | CAPT-03 | manual | Manual — requires display | ❌ Manual | ⬜ pending |
| TBD | 01 | — | CAPT-04 | manual | Manual — requires display | ❌ Manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/main/capture.test.ts` — stubs for CAPT-05, FILE-01, PLAT-01, PLAT-05, INST-03
- [ ] `src/main/index.test.ts` — stubs for PLAT-02, PLAT-03, PLAT-04, PLAT-06
- [ ] `bin/snapview.test.cjs` — stub for INST-02
- [ ] `bun:test` — no additional install required (built into Bun)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fullscreen dimmed overlay appears with crosshair cursor | CAPT-01 | Requires display + visual render | Run `snapview`, verify overlay covers active monitor with ~50% dim |
| Drag-to-select shows clear cutout with border | CAPT-02 | Requires display + mouse interaction | Drag region, verify full-brightness cutout + subtle border |
| Preview panel shows approve/retake after selection | CAPT-03 | Requires display + render | Complete selection, verify approve/retake buttons visible |
| ESC closes overlay cleanly, no orphaned processes | CAPT-04 | Requires display + process check | Press ESC, verify process exits, check `ps aux | grep snapview` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
