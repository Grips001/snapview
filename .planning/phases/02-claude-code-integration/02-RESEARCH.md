# Phase 2: Claude Code Integration - Research

**Researched:** 2026-03-17
**Domain:** Claude Code extension system (skills, hooks, plugins, settings.json)
**Confidence:** HIGH — all findings verified against official Claude Code documentation at code.claude.com

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Skill trigger flow:**
- `/snapview` is a bare command — no arguments, no optional prompt text
- After capture completes, Claude auto-reads the screenshot into context (no user confirmation step)
- While capture UI is open, Claude shows a brief status message (e.g., "Launching capture UI...")
- On user cancel (ESC), Claude offers to retry ("Screenshot cancelled. Want to try again?")
- Skill registration mechanism must follow latest Claude Code documented best practices — researcher must investigate current recommended approach for skills/plugins/extensions before assuming skill.md pattern

**Auto-trigger signal:**
- Both mechanisms: Claude can auto-trigger capture via its own signal, AND Claude can suggest `/snapview` when it detects relevant user intent
- No keyword-based auto-launch — user must explicitly invoke `/snapview` or Claude must trigger via hooks signal
- Claude suggesting `/snapview` is fine; auto-launching capture from user keywords is not
- Result injection: prefer hook response/additionalContext mechanism, but researcher must validate against latest docs
- Global toggle in `~/.claude/settings.json` to enable/disable auto-trigger feature
- Hook event selection (UserPromptSubmit vs PostToolUse) and signal format must be validated against current docs

**Install experience:**
- One-command install: `npm i -g snapview` or `bun add -g snapview` installs the binary AND auto-registers skill + hooks via postinstall script
- Both npm and bun must be supported
- If `~/.claude/` doesn't exist, error with guidance: "Claude Code not detected. Install Claude Code first, then re-run."
- Idempotent registration — always overwrites with latest config, no version tracking
- Success-only output — just "Snapview installed successfully!" (no config details)
- Explicit uninstall command to remove skill + hooks from `~/.claude/`
- `settings.json` merge must be read-modify-write, not overwrite — preserve existing hooks/config

**Error & edge cases:**
- If snapview isn't installed, `/snapview` doesn't exist as a command (install creates both binary and skill registration together)
- On timeout (30s hard-exit), Claude explains and continues
- Outside Claude Code: ideally don't run; if too difficult to prevent, fall back to normal capture-to-stdout
- Concurrent sessions: independent — each session launches its own capture, no locking needed

### Claude's Discretion
- CLI subcommand vs flag design for install/uninstall (e.g., `snapview install` vs `snapview --setup`)
- Execution mechanism for running the binary from skill (Bash tool or other)
- Whether skill.md includes proactive hints for when Claude should suggest `/snapview`
- Exact install command format for the one-command experience

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INTG-01 | User can type `/snapview` in Claude Code to launch the capture UI | Skills system via `~/.claude/skills/snapview/SKILL.md` creates `/snapview` slash command globally |
| INTG-02 | Claude can auto-trigger the capture UI when it needs to see something | `Stop` hook inspects `last_assistant_message` for a structured trigger signal; PostToolUse also supported |
| INTG-03 | Global install automatically registers skill and hooks in `~/.claude/` (available in all projects) | `~/.claude/skills/snapview/SKILL.md` + `~/.claude/settings.json` hooks entry are globally scoped |
| INTG-04 | Captured screenshot path is injected into Claude's context via stdout + Read tool | Hook `additionalContext` field confirmed for UserPromptSubmit and PostToolUse; skill can use Bash tool to run binary and instruct Claude to read the file |
| INST-01 | `npm i -g snapview` / `bun add -g snapview` installs AND configures Claude Code integration | `postinstall` script in package.json writes SKILL.md and merges hooks into `~/.claude/settings.json` |
</phase_requirements>

---

## Summary

The Claude Code extension system has evolved significantly. The modern approach uses **Skills** (the Agent Skills open standard, `~/.claude/skills/<name>/SKILL.md`) rather than a separate skill.md file. Custom slash commands and skills are now unified — placing a `SKILL.md` in `~/.claude/skills/snapview/` creates the `/snapview` command globally across all projects. The older `~/.claude/commands/` directory still works but skills are the recommended pattern.

Context injection from hooks is fully confirmed and well-documented. The `additionalContext` field in `hookSpecificOutput` is available for `UserPromptSubmit`, `PostToolUse`, `Stop`, `SessionStart`, and other events. Plain stdout text on exit code 0 also works as a simpler alternative. The `Stop` hook is the correct choice for an auto-trigger pattern where Claude emits a signal at the end of its response — it receives `last_assistant_message` which can be scanned for a structured JSON trigger.

The install story is a direct postinstall script approach — no plugin marketplace required. The `npm i -g snapview` flow runs a Node.js postinstall script that writes `~/.claude/skills/snapview/SKILL.md` and performs a read-modify-write merge of `~/.claude/settings.json`. This is entirely within the npm/bun package system and does not depend on Claude's plugin marketplace mechanism.

**Primary recommendation:** Use standalone skill registration (not the plugin marketplace system) — write files directly to `~/.claude/skills/` and merge `~/.claude/settings.json` from the postinstall script. The plugin marketplace is for community distribution, not for this kind of tool's self-registration pattern.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| commander | 14.0.3 | CLI argument parsing for `snapview install`/`snapview uninstall` subcommands | Already in dependencies; purpose-built for this pattern |
| Node.js `fs` | built-in | Read-modify-write `~/.claude/settings.json` | No external dep needed; JSON parse/stringify is sufficient |
| Node.js `os` | built-in | Resolve `~/.claude/` path cross-platform (`os.homedir()`) | Avoids `~` expansion issues across shells |
| Node.js `path` | built-in | Resolve `~/.claude/skills/snapview/SKILL.md` target paths | Standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js `child_process` | built-in | Run `snapview` binary from within a skill's Bash tool invocation | Used by Claude Code internally; skill instructs Claude to use Bash |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Standalone skill in `~/.claude/skills/` | Plugin marketplace system | Plugin marketplace requires public hosting, marketplace.json, `/plugin install` command — overkill for self-installing tool; standalone is the right pattern |
| `Stop` hook for auto-trigger | `UserPromptSubmit` hook for auto-trigger | UserPromptSubmit fires before Claude responds (wrong timing for auto-trigger); Stop fires after Claude finishes and receives `last_assistant_message` — correct for reading Claude's output signal |
| `additionalContext` in hook output | Plain stdout text | Both work; `additionalContext` is more structured and explicit about intent |

**Installation (postinstall script):**
```bash
# No additional npm packages needed — postinstall uses Node.js built-ins only
```

---

## Architecture Patterns

### Recommended Project Structure

```
snapview/
├── bin/
│   └── snapview.cjs          # CLI entry — add install/uninstall subcommands here
├── src/
│   └── main/
│       └── index.ts          # Electron main — unchanged from Phase 1
├── scripts/
│   └── postinstall.cjs       # npm postinstall: writes ~/.claude/skills/ + settings.json
└── claude-integration/
    └── SKILL.md              # Template for the skill (postinstall copies this)
```

### Pattern 1: Skill Registration (Global `/snapview` Command)

**What:** Place a `SKILL.md` file at `~/.claude/skills/snapview/SKILL.md`. This creates the `/snapview` slash command available in all Claude Code projects.

**When to use:** Always — this is the mechanism for registering a user-invokable slash command globally.

**Key frontmatter fields for snapview:**
```yaml
# Source: https://code.claude.com/docs/en/slash-commands
---
name: snapview
description: Capture a screen region and inject it into Claude's context. Use when you need to see the user's screen, UI, or terminal output.
disable-model-invocation: true
allowed-tools: Bash(snapview *)
---
```

`disable-model-invocation: true` is CRITICAL — prevents Claude from auto-launching the capture UI when it detects vaguely relevant keywords. The user or Claude must explicitly decide to invoke it.

**Full SKILL.md template:**
```markdown
---
name: snapview
description: Capture a screen region and inject the screenshot into Claude's context. Use when you need to see the user's screen, UI, terminal output, or visual content. Suggest this when the user says things like "let me show you", "look at this", "check this UI", or similar.
disable-model-invocation: true
allowed-tools: Bash(snapview *)
---

Launch the screen capture UI so the user can select a region of their screen.

Steps:
1. Tell the user: "Launching capture UI..." (brief status message)
2. Run: `snapview` using the Bash tool
3. If exit code is 0: the file path is printed to stdout. Read that file immediately using the Read tool and continue the conversation with the screenshot in context.
4. If exit code is 2 (user cancelled): respond with "Screenshot cancelled. Want to try again?"
5. If exit code is 1 (error): respond with "Screenshot failed. You may need to check permissions or try again."
6. If the command times out (30s): respond with "Screenshot capture timed out. The capture window may need to be closed manually."
```

### Pattern 2: Stop Hook for Auto-Trigger Signal

**What:** A `Stop` hook that inspects Claude's `last_assistant_message` for a structured JSON trigger signal. When Claude emits the signal, the hook runs the capture binary and injects the result into Claude's next context turn.

**When to use:** For INTG-02 (Claude auto-triggering capture programmatically without user typing `/snapview`).

**Hook event confirmed:** `Stop` — fires when Claude finishes responding. Input includes `last_assistant_message` with full text of Claude's response. Can return `decision: "block"` to make Claude continue (re-read from stdin).

**Signal format in Claude's response:**
```json
{"snapview_capture": true, "reason": "I need to see the current state of the UI"}
```

**Hook script (`~/.claude/hooks/snapview-autotrigger.sh`):**
```bash
#!/bin/bash
# Source: https://code.claude.com/docs/en/hooks (Stop event schema)

INPUT=$(cat)
LAST_MSG=$(echo "$INPUT" | jq -r '.last_assistant_message // ""')

# Check for structured trigger signal
if echo "$LAST_MSG" | jq -e '.snapview_capture == true' > /dev/null 2>&1; then
  # Run capture — binary prints file path to stdout on success
  FILE_PATH=$(snapview 2>/dev/null)
  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 0 ] && [ -n "$FILE_PATH" ]; then
    jq -n --arg path "$FILE_PATH" '{
      "decision": "block",
      "reason": "Screenshot captured. Read the file at: " + $path + " and continue the conversation with the screenshot in context."
    }'
  elif [ $EXIT_CODE -eq 2 ]; then
    # User cancelled — do not block, let Claude continue
    exit 0
  else
    jq -n '{
      "decision": "block",
      "reason": "Screenshot capture failed or timed out. Continue without the screenshot."
    }'
  fi
else
  exit 0
fi
```

**settings.json hooks entry:**
```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/snapview-autotrigger.sh",
            "timeout": 35
          }
        ]
      }
    ]
  }
}
```

**Global toggle pattern** (disable auto-trigger via settings.json env variable):
```json
{
  "env": {
    "SNAPVIEW_AUTO_TRIGGER": "1"
  }
}
```

The hook script checks `$SNAPVIEW_AUTO_TRIGGER` and exits 0 immediately if not set. This satisfies the "global toggle in `~/.claude/settings.json`" locked decision.

### Pattern 3: Read-Modify-Write Settings Merge (postinstall script)

**What:** The postinstall script reads `~/.claude/settings.json`, merges the snapview hooks entry, and writes it back. Preserves all existing config.

**When to use:** During `npm i -g snapview` and `snapview uninstall`.

```javascript
// Source: Node.js built-ins — no external deps
// scripts/postinstall.cjs
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const SETTINGS_PATH = path.join(CLAUDE_DIR, 'settings.json');
const SKILLS_DIR = path.join(CLAUDE_DIR, 'skills', 'snapview');
const SKILL_PATH = path.join(SKILLS_DIR, 'SKILL.md');
const HOOKS_DIR = path.join(CLAUDE_DIR, 'hooks');
const HOOK_PATH = path.join(HOOKS_DIR, 'snapview-autotrigger.sh');

function install() {
  // Check Claude Code is installed
  if (!fs.existsSync(CLAUDE_DIR)) {
    console.error('Claude Code not detected. Install Claude Code first, then re-run.');
    process.exit(1);
  }

  // Write skill file
  fs.mkdirSync(SKILLS_DIR, { recursive: true });
  fs.writeFileSync(SKILL_PATH, SKILL_MD_CONTENT, 'utf8');

  // Write hook script
  fs.mkdirSync(HOOKS_DIR, { recursive: true });
  fs.writeFileSync(HOOK_PATH, HOOK_SCRIPT_CONTENT, 'utf8');
  fs.chmodSync(HOOK_PATH, 0o755); // Make executable

  // Read-modify-write settings.json
  let settings = {};
  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    } catch {
      // Malformed settings.json — preserve it, add alongside
    }
  }

  // Deep merge hooks entry (preserve existing hooks)
  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.Stop) settings.hooks.Stop = [];

  // Remove any existing snapview hook (idempotent)
  settings.hooks.Stop = settings.hooks.Stop.filter(
    entry => !JSON.stringify(entry).includes('snapview-autotrigger')
  );

  // Add snapview hook
  settings.hooks.Stop.push({
    hooks: [{
      type: 'command',
      command: HOOK_PATH,
      timeout: 35
    }]
  });

  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
  console.log('Snapview installed successfully!');
}
```

### Pattern 4: Commander Subcommands for install/uninstall

**What:** Add `snapview install` and `snapview uninstall` subcommands to `bin/snapview.cjs` before the Electron spawn logic.

**When to use:** When user wants to re-register or remove the Claude Code integration without reinstalling the npm package.

```javascript
// bin/snapview.cjs — add before Electron spawn
const { Command } = require('commander');
const program = new Command();

program
  .command('install')
  .description('Register snapview skill and hooks in ~/.claude/')
  .action(() => {
    require('../scripts/postinstall.cjs').install();
    process.exit(0);
  });

program
  .command('uninstall')
  .description('Remove snapview skill and hooks from ~/.claude/')
  .action(() => {
    require('../scripts/postinstall.cjs').uninstall();
    process.exit(0);
  });

// Only parse if subcommand args are present
// Otherwise fall through to Electron spawn
const args = process.argv.slice(2);
if (args.length > 0 && ['install', 'uninstall'].includes(args[0])) {
  program.parse(process.argv);
} else {
  // Existing Electron spawn logic
  const { spawn } = require('child_process');
  // ... (Phase 1 code)
}
```

### Anti-Patterns to Avoid

- **Using the plugin marketplace for self-registration:** Plugin marketplaces require public hosting and `/plugin install` commands. For a self-installing npm tool, direct file writes to `~/.claude/` are the correct approach.
- **Overwriting settings.json:** Must read-modify-write. Overwriting destroys existing hooks configured by the user.
- **Using `UserPromptSubmit` for auto-trigger:** Wrong event — fires before Claude processes the prompt, not after Claude decides it wants a screenshot. Use `Stop` which fires after Claude's response and exposes `last_assistant_message`.
- **Omitting `disable-model-invocation: true` in SKILL.md:** Without this, Claude can auto-invoke `/snapview` whenever it thinks a screenshot might be useful, violating the locked decision that auto-launch from keywords is not allowed.
- **Setting `timeout` less than 30s on the hook:** The Electron process has a 30s hard-exit timer. The hook timeout must be >= 35s to allow the full capture workflow before the hook itself times out.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Settings JSON deep merge | Custom recursive merge function | `JSON.parse` + explicit key merging + `JSON.stringify` | Settings structure is shallow enough that targeted key insertion is correct; generic deep merge can corrupt existing hook arrays |
| Hook-to-Claude communication protocol | Custom IPC or socket server | `additionalContext` in hook output JSON OR `decision: "block"` with `reason` text | Both mechanisms are official and reliable; don't add a network layer |
| Skill routing / command parsing | Custom command dispatcher | Claude Code's native skill system (`~/.claude/skills/`) | The platform handles routing, invocation, argument passing — nothing to build |
| Cross-shell `~` expansion | Custom path resolution | `os.homedir()` | `os.homedir()` works correctly on Windows (returns `C:\Users\<name>`), macOS, and Linux |

**Key insight:** The Claude Code platform handles ALL the hard parts of command registration, context injection, and permission management. The implementation is almost entirely file writes and hook scripts.

---

## Common Pitfalls

### Pitfall 1: Hook Timeout Shorter Than Electron Hard-Exit

**What goes wrong:** Hook exits with code 1 (timeout) at 30s, but the Electron capture window is still open and the user is mid-selection. Claude Code marks the hook as failed, the user's partial work is lost.

**Why it happens:** The hook's `timeout` field defaults to 600s but if set explicitly to 30s (matching the Electron timer), there's a race condition. The hook process itself has no time buffer.

**How to avoid:** Set hook `timeout: 35` in the hooks entry (5 second buffer above Electron's 30s hard-exit). The hook will terminate 5s after Electron already force-quit.

**Warning signs:** Users report "Screenshot capture timed out" immediately after Electron closes, even though they were actively using it.

### Pitfall 2: settings.json Write During Active Session

**What goes wrong:** User installs snapview while Claude Code is running. Claude Code may have loaded settings.json into memory. The postinstall changes won't take effect until the session is restarted.

**Why it happens:** Claude Code reads configuration at startup. Changes to `~/.claude/settings.json` during a session are not automatically hot-reloaded for hooks (though they are for skills via live change detection).

**How to avoid:** Postinstall script is correct to write the file. Instruct users in the success message to restart Claude Code if it's currently running. (Note: skills in `~/.claude/skills/` ARE live-detected during sessions — only the `settings.json` hooks change requires restart.)

**Warning signs:** `/snapview` appears immediately after install (skill live-reload works) but the auto-trigger hook does not fire until session restart.

### Pitfall 3: Detecting Claude Code Installation

**What goes wrong:** Script checks for `~/.claude/` directory existence. Directory might not exist on first install even though Claude Code is installed (user has never launched it). Or directory exists from an old install.

**Why it happens:** `~/.claude/` is created lazily on first Claude Code launch, not on installation.

**How to avoid:** Check for both `~/.claude/` OR the Claude Code binary in PATH (`which claude` / `where claude`). If the directory doesn't exist but the binary does, create it. If neither exists, give the error.

**Warning signs:** Users who have Claude Code installed but never launched it get the "Claude Code not detected" error.

### Pitfall 4: Windows Path in Hook Command

**What goes wrong:** Hook script path contains backslashes (Windows) which are not valid in JSON settings.json on Claude Code for Windows.

**Why it happens:** `os.homedir()` on Windows returns `C:\Users\username`, and `path.join()` uses backslashes by default.

**How to avoid:** Use forward slashes in the settings.json command path: `path.join(CLAUDE_DIR, 'hooks', 'snapview-autotrigger.sh').replace(/\\/g, '/')`.

**Warning signs:** Hook never fires on Windows even though the file exists.

### Pitfall 5: Shell Script on Windows

**What goes wrong:** `~/.claude/hooks/snapview-autotrigger.sh` is a bash script. Claude Code on Windows (native, not WSL) may not have bash available.

**Why it happens:** Bash hooks work on macOS and Linux natively. Windows requires Git Bash, WSL, or a comparable bash environment in PATH.

**How to avoid:** Make the hook a Node.js script (`snapview-autotrigger.js`) invoked as `node ~/.claude/hooks/snapview-autotrigger.js`. Node.js is guaranteed to be available since snapview itself is an npm package.

**Warning signs:** Hook silently fails on Windows (exit code other than 0 or 2 treated as non-blocking error).

### Pitfall 6: SKILL.md `disable-model-invocation` Omitted

**What goes wrong:** Claude auto-invokes `/snapview` every time it sees UI-related questions, even when the user hasn't asked for a screenshot.

**Why it happens:** Without `disable-model-invocation: true`, Claude reads the skill description and uses it to decide when to trigger it. The description mentions "check this UI" which matches many conversations.

**How to avoid:** Always set `disable-model-invocation: true` in the SKILL.md frontmatter. This is a locked decision.

---

## Code Examples

Verified patterns from official documentation (https://code.claude.com/docs):

### SKILL.md Frontmatter (full verified format)
```yaml
# Source: https://code.claude.com/docs/en/slash-commands
---
name: snapview
description: Capture a screen region and inject the screenshot into Claude's context.
disable-model-invocation: true
allowed-tools: Bash(snapview)
---
```

### Hook Output: additionalContext injection (UserPromptSubmit)
```json
// Source: https://code.claude.com/docs/en/hooks
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "Here is related context"
  }
}
```

### Hook Output: Stop event with block+reason (auto-trigger)
```json
// Source: https://code.claude.com/docs/en/hooks (Stop Decision Control)
{
  "decision": "block",
  "reason": "Screenshot captured. Read the file at: /tmp/snapview/capture-abc123.png and continue."
}
```

### Stop Hook Input Schema
```json
// Source: https://code.claude.com/docs/en/hooks (Stop Input section)
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/current/working/directory",
  "hook_event_name": "Stop",
  "stop_hook_active": false,
  "last_assistant_message": "Claude's full response text..."
}
```

### Hook Configuration in settings.json
```json
// Source: https://code.claude.com/docs/en/hooks (Configuration Format)
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/home/user/.claude/hooks/snapview-autotrigger.js",
            "timeout": 35
          }
        ]
      }
    ]
  }
}
```

### Global Skill Directory Structure
```
~/.claude/
├── settings.json           # hooks entry + SNAPVIEW_AUTO_TRIGGER env toggle
├── skills/
│   └── snapview/
│       └── SKILL.md        # Creates /snapview command globally
└── hooks/
    └── snapview-autotrigger.js  # Node.js hook (cross-platform)
```

### package.json postinstall entry
```json
{
  "scripts": {
    "postinstall": "node scripts/postinstall.cjs"
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `~/.claude/commands/deploy.md` flat file | `~/.claude/skills/deploy/SKILL.md` directory with frontmatter | Recent (Skills are the recommended pattern as of current docs) | More features: `disable-model-invocation`, `allowed-tools`, `context: fork`, supporting files |
| Separate skill.md pattern (assumed from older knowledge) | Skills via Agent Skills open standard | Current | Skills and commands are unified — both work, skills are preferred |
| No invocation control | `disable-model-invocation: true` / `user-invocable: false` frontmatter | Current | Can precisely control whether user or model or both can invoke |
| Unknown hook events for auto-trigger | `Stop` hook confirmed with `last_assistant_message` + `decision: "block"` | Verified 2026-03-17 | Auto-trigger pattern is well-supported |

**Deprecated/outdated:**
- `~/.claude/commands/` directory: Still works but skills (`~/.claude/skills/`) are the recommended pattern — "Custom commands have been merged into skills." Both create the same slash command.

---

## Open Questions

1. **Windows bash hook fallback**
   - What we know: Bash scripts in hooks work on macOS/Linux; Windows requires bash in PATH
   - What's unclear: Does Claude Code for Windows (native, not WSL) have bash available? Does it ship with Git Bash?
   - Recommendation: Use Node.js script for the hook (`node path/to/hook.js`) to guarantee cross-platform compatibility. Node.js is guaranteed available on all platforms since snapview is an npm package.

2. **Auto-trigger toggle via env variable in settings.json**
   - What we know: `settings.json` has an `env` key that sets environment variables for all sessions
   - What's unclear: The toggle mechanism was locked as "global toggle in `~/.claude/settings.json`" — the exact implementation is discretionary. Using `env.SNAPVIEW_AUTO_TRIGGER` is clean but requires the hook script to check it.
   - Recommendation: Use `env: { "SNAPVIEW_AUTO_TRIGGER": "1" }` in settings.json as the enablement flag. Hook exits 0 immediately if var is not set. This satisfies the locked decision cleanly.

3. **Whether `/snapview` can detect it's running inside Claude Code**
   - What we know: The Electron binary runs as a subprocess of the hook. `CLAUDE_SESSION_ID` env variable is available in hook context (injected by Claude Code).
   - What's unclear: Whether `CLAUDE_SESSION_ID` propagates to the child process (snapview binary) spawned by the hook.
   - Recommendation: The skill itself only runs inside Claude Code (it's Claude executing Bash). The hook only runs inside Claude Code. The "outside Claude Code fallback" concern applies to users who run `snapview` directly in a terminal — in that case, no hook is involved, and the binary runs normally. This is fine — no special detection needed.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test (built-in, version matches bun runtime) |
| Config file | none — `bun test` auto-discovers `*.test.ts` files |
| Quick run command | `bun test src/main/` |
| Full suite command | `bun test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INTG-01 | `~/.claude/skills/snapview/SKILL.md` is written correctly by postinstall | unit | `bun test scripts/postinstall.test.ts` | ❌ Wave 0 |
| INTG-02 | Hook script exits 0 when no trigger signal; emits block+reason when signal present | unit | `bun test scripts/snapview-autotrigger.test.ts` | ❌ Wave 0 |
| INTG-03 | postinstall creates correct files in mock `~/.claude/` dir | unit | `bun test scripts/postinstall.test.ts` | ❌ Wave 0 |
| INTG-04 | Hook output JSON has correct `additionalContext` / `decision` + `reason` fields | unit | `bun test scripts/snapview-autotrigger.test.ts` | ❌ Wave 0 |
| INST-01 | `npm install` triggers postinstall; postinstall is idempotent on re-run | integration (manual) | Verify in fresh tmpdir: `npm install -g .` → check `~/.claude/` | manual-only |

**Note on INST-01:** The full npm install flow cannot be automated without a real `~/.claude/` directory and npm global scope. Unit tests cover the postinstall logic in isolation using temp directories. Manual verification is required for the end-to-end install path.

### Sampling Rate
- **Per task commit:** `bun test src/main/` (existing tests, fast)
- **Per wave merge:** `bun test` (all tests including new postinstall/hook tests)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `scripts/postinstall.test.ts` — covers INTG-01, INTG-03: tests file creation, idempotency, settings.json merge, Claude Code detection
- [ ] `scripts/snapview-autotrigger.test.ts` — covers INTG-02, INTG-04: tests hook input parsing, signal detection, JSON output format, exit codes
- [ ] `claude-integration/SKILL.md` — source template for postinstall to copy (not a test file, but a Wave 0 artifact)
- [ ] `scripts/postinstall.cjs` — the script itself (Wave 0 deliverable before tests can run)

---

## Sources

### Primary (HIGH confidence)
- `https://code.claude.com/docs/en/slash-commands` — Skills system, SKILL.md format, frontmatter fields (`disable-model-invocation`, `allowed-tools`, `user-invocable`), skill directory structure, global vs project scope
- `https://code.claude.com/docs/en/hooks` — Complete hooks reference: all event types, input schemas, output JSON format, `additionalContext`, `Stop` event input including `last_assistant_message`, `decision: "block"` with `reason`, hook configuration format in settings.json, exit code semantics
- `https://code.claude.com/docs/en/settings` — settings.json scopes, `~/.claude/settings.json` for user scope, hooks configuration key, `env` key for environment variables
- `https://code.claude.com/docs/en/plugins` — Plugin system overview, standalone vs plugin distinction, when to use each approach, plugin directory structure
- `https://code.claude.com/docs/en/plugins-reference` — Plugin manifest schema, hooks.json format, `${CLAUDE_PLUGIN_ROOT}` variable, CLI commands (`claude plugin install`)
- `https://code.claude.com/docs/en/discover-plugins` — Plugin installation scopes, marketplace mechanics (confirmed: NOT needed for self-installing npm tools)

### Secondary (MEDIUM confidence)
- Phase 1 codebase: `bin/snapview.cjs`, `src/main/index.ts`, `src/shared/types.ts` — confirmed exit codes (0/1/2), 30s hard-exit timer, stdout pipe for file path
- `npm view commander version` — confirmed 14.0.3 is current stable version

### Tertiary (LOW confidence)
- None — all key findings verified against official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified all key libraries against npm registry and official docs
- Architecture: HIGH — all patterns sourced directly from official Claude Code documentation at code.claude.com
- Pitfalls: HIGH (patterns 1-4) / MEDIUM (patterns 5-6) — cross-platform edge cases inferred from known behavior, not documented explicitly
- Validation architecture: HIGH — test framework verified from Phase 1 (bun test is already in use)

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (30 days — Claude Code extension system is actively developed but core APIs are stable)

**Critical discovery:** The `Stop` hook is confirmed to receive `last_assistant_message` and supports `decision: "block"` — this fully enables INTG-02 (Claude auto-trigger) without any custom protocol or IPC mechanism. The entire auto-trigger flow is: Claude emits JSON signal in its response → Stop hook reads `last_assistant_message` → hook runs `snapview` → hook returns `decision: block` + `reason` with file path → Claude reads the file path and continues.
