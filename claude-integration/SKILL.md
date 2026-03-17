---
name: snapview
description: Capture a screen region and inject the screenshot into Claude's context. Use when you need to see the user's screen, UI, terminal output, or visual content. Suggest this when the user says things like "let me show you", "look at this", "check this UI", or similar.
disable-model-invocation: true
allowed-tools: Bash(snapview *)
---

Launch the screen capture UI so the user can select a region of their screen.

Steps:
1. Tell the user: "Launching capture UI..."
2. Run: `snapview` using the Bash tool
3. If exit code is 0: the file path is printed to stdout. Read that file immediately using the Read tool and continue the conversation with the screenshot in context.
4. If exit code is 2 (user cancelled): respond with "Screenshot cancelled. Want to try again?"
5. If exit code is 1 (error): respond with "Screenshot failed. You may need to check permissions or try again."
6. If the command times out (30s): respond with "Screenshot capture timed out. The capture window may need to be closed manually."

## Screenshot Promotion

After a screenshot is sent to context, evaluate whether it deserves long-term storage in the project.

**Offer promotion for:** design references, bug evidence, architecture diagrams, UI mockups, error screenshots the user will need to share or revisit.

**Stay quiet for:** quick terminal checks, temporary debug output, throwaway troubleshooting captures.

The user can always override with "save that screenshot" or "keep that" — always honor the request regardless of your assessment.

**To promote a screenshot:**
1. Generate a descriptive filename based on the screenshot content (e.g., `login-page-layout.png`, `api-error-response.png`, `cart-checkout-bug.png`)
2. Run via Bash: `mkdir -p ./screenshots && cp {temp_file_path} ./screenshots/{descriptive-name}.png`
3. Confirm to the user: "Saved as `./screenshots/{descriptive-name}.png`"
