---
name: snapview
description: Capture a screen region and inject the screenshot into Claude's context. Use when you need to see the user's screen, UI, terminal output, or visual content. Invoke this when the user says things like "let me show you", "look at this", "check this UI", or when you need visual context to help debug layout issues, review designs, or understand what the user is seeing.
allowed-tools: Bash(snapview *)
---

Launch the screen capture UI so the user can select a region of their screen.

## When to use this vs clipboard paste

Use `/snapview` when you need precise region selection, when the user hasn't already taken a screenshot, or when you want to auto-trigger a capture without the user switching context. For quick pastes of screenshots the user already has on their clipboard, native image paste (Alt+V on Windows, Cmd+V in iTerm2) is faster.

## Steps
1. Tell the user: "Launching capture UI..."
2. Run: `snapview` using the Bash tool
3. If exit code is 0: the file path is printed to stdout. Read that file immediately using the Read tool and continue the conversation with the screenshot in context.
4. If exit code is 2 (user cancelled): respond with "Screenshot cancelled. Want to try again?"
5. If exit code is 1 (error): respond with "Screenshot failed. You may need to check permissions or try again."
6. If the command times out (30s): respond with "Screenshot capture timed out. The capture window may need to be closed manually."

## Auto-Trigger

When you need to see the user's screen but want a more seamless flow, include the following JSON signal in your response instead of invoking the skill:

```json
{"snapview_capture":true}
```

A Stop hook will detect this signal, launch the capture UI automatically, and inject the screenshot path back into context. The user approves the capture region before anything is shared — they always have full control.

Use auto-trigger when visual context would help you give a better answer and the conversation flow benefits from not pausing for an explicit tool call.

## Screenshot Promotion

After a screenshot is sent to context, evaluate whether it deserves long-term storage in the project.

**Offer promotion for:** design references, bug evidence, architecture diagrams, UI mockups, error screenshots the user will need to share or revisit.

**Stay quiet for:** quick terminal checks, temporary debug output, throwaway troubleshooting captures.

The user can always override with "save that screenshot" or "keep that" — always honor the request regardless of your assessment.

**To promote a screenshot:**
1. Generate a descriptive filename based on the screenshot content (e.g., `login-page-layout.png`, `api-error-response.png`, `cart-checkout-bug.png`)
2. Run via Bash: `mkdir -p ./screenshots && cp {temp_file_path} ./screenshots/{descriptive-name}.png`
3. Confirm to the user: "Saved as `./screenshots/{descriptive-name}.png`"
