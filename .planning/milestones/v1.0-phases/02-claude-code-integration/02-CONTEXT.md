# Phase 2: Claude Code Integration - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the Phase 1 capture engine into Claude Code. Deliver three things: a `/snapview` skill command that launches capture and injects the screenshot into Claude's context, a hooks-based auto-trigger so Claude can request a screenshot programmatically, and a one-command global install (`npm i -g snapview` / `bun add -g snapview`) that registers both the skill and hooks in `~/.claude/` with no extra steps.

</domain>

<decisions>
## Implementation Decisions

### Skill trigger flow
- `/snapview` is a bare command — no arguments, no optional prompt text
- After capture completes, Claude auto-reads the screenshot into context (no user confirmation step)
- While capture UI is open, Claude shows a brief status message (e.g., "Launching capture UI...")
- On user cancel (ESC), Claude offers to retry ("Screenshot cancelled. Want to try again?")
- Skill registration mechanism must follow latest Claude Code documented best practices — researcher must investigate current recommended approach for skills/plugins/extensions before assuming skill.md pattern

### Auto-trigger signal
- Both mechanisms: Claude can auto-trigger capture via its own signal, AND Claude can suggest `/snapview` when it detects relevant user intent ("let me show you", "check this UI")
- No keyword-based auto-launch — user must explicitly invoke `/snapview` or Claude must trigger via hooks signal
- Claude suggesting `/snapview` is fine; auto-launching capture from user keywords is not
- Result injection: prefer hook response/additionalContext mechanism, but researcher must validate against latest Claude Code hooks documentation
- Global toggle in `~/.claude/settings.json` to enable/disable auto-trigger feature
- Hook event selection (UserPromptSubmit vs PostToolUse) and signal format must be validated against current docs — STATE.md notes UserPromptSubmit confirmed, PostToolUse unconfirmed

### Install experience
- One-command install: `npm i -g snapview` or `bun add -g snapview` installs the binary AND auto-registers skill + hooks via postinstall script
- Both npm and bun must be supported
- If `~/.claude/` doesn't exist, error with guidance: "Claude Code not detected. Install Claude Code first, then re-run."
- Idempotent registration — always overwrites with latest config, no version tracking
- Success-only output — just "Snapview installed successfully!" (no config details)
- Explicit uninstall command to remove skill + hooks from `~/.claude/`
- `settings.json` merge must be read-modify-write, not overwrite — preserve existing hooks/config

### Error & edge cases
- If snapview isn't installed, `/snapview` doesn't exist as a command (install creates both binary and skill registration together)
- On timeout (30s hard-exit), Claude explains and continues: "Screenshot capture timed out. The capture window may need to be closed manually."
- Outside Claude Code: ideally don't run; if too difficult to prevent, fall back to normal capture-to-stdout
- Concurrent sessions: independent — each session launches its own capture, no locking needed (unique temp file per capture)

### Claude's Discretion
- CLI subcommand vs flag design for install/uninstall (e.g., `snapview install` vs `snapview --setup`)
- Execution mechanism for running the binary from skill (Bash tool or other)
- Whether skill.md includes proactive hints for when Claude should suggest `/snapview`
- Exact install command format for the one-command experience

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Claude Code Extension System (CRITICAL — research required)
- **Latest Claude Code documentation on skills, hooks, and extensions** — Researcher MUST fetch and review current best practices for registering custom commands/plugins. Do not assume skill.md pattern is current. Validate:
  - How to register a `/command` (skill file? commands directory? other mechanism?)
  - How hooks work (UserPromptSubmit, PostToolUse, additionalContext)
  - How to inject content into Claude's context from hooks
  - How `~/.claude/` directory structure works for global extensions
  - How settings.json hooks configuration works

### Project Specs
- `.planning/PROJECT.md` — Core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — INTG-01 through INTG-04, INST-01 requirements
- `.planning/ROADMAP.md` — Phase 2 success criteria and dependencies

### Phase 1 Implementation (existing code)
- `bin/snapview.cjs` — CLI entry point: spawns Electron, pipes stdout (file path on success)
- `src/main/index.ts` — Exit codes: 0=success, 1=error, 2=cancelled. 30s hard-exit timeout. IPC channels.
- `src/shared/types.ts` — CaptureResult type, IPC_CHANNELS constants
- `package.json` — Current bin entry, commander dependency already present

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `bin/snapview.cjs`: CLI entry point already handles spawning Electron and piping stdout — install/uninstall subcommands can be added here using commander (already a dependency)
- `src/shared/types.ts`: IPC_CHANNELS and CaptureResult types — hook integration can reuse these contracts
- Exit code convention (0/1/2): hooks can branch on exit code to determine success/cancel/error

### Established Patterns
- commander for CLI argument parsing (already in dependencies)
- Electron spawned as child process with stdout piped — same pattern works for hook invocation
- `process.stdout.write(filePath)` for machine-readable output — hooks can capture this

### Integration Points
- `~/.claude/skills/` or equivalent — skill registration target (validate with docs)
- `~/.claude/settings.json` — hooks registration target (read-modify-write merge)
- `bin/snapview.cjs` — needs install/uninstall subcommands before Electron spawn logic
- `package.json` — needs postinstall script entry

</code_context>

<specifics>
## Specific Ideas

- User strongly emphasized: follow the latest Claude Code documentation for skills, hooks, and extensions — do not make assumptions about the registration mechanism
- The install must feel like one command, zero extra steps — "npm i -g snapview" and everything works
- `/snapview` should not exist if snapview isn't installed (install creates both binary and command together)
- User prefers snapview not to work outside Claude Code, but accepts stdout fallback if prevention is too complex

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-claude-code-integration*
*Context gathered: 2026-03-17*
