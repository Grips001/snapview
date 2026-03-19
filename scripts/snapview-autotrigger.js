#!/usr/bin/env node
'use strict';

const { execFileSync } = require('child_process');

let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  // Check global auto-trigger toggle first — exit silently if not enabled
  if (process.env.SNAPVIEW_AUTO_TRIGGER !== '1') {
    process.exit(0);
  }

  // Parse the Stop hook input JSON
  let hookInput;
  try {
    hookInput = JSON.parse(input);
  } catch {
    // Malformed input — exit silently, don't block Claude
    process.exit(0);
  }

  const lastMessage = hookInput.last_assistant_message || '';

  // Check for trigger signal — fast substring scan first, then structured parse.
  // Substring check is O(n) with no allocations; JSON.parse on prose messages
  // throws an exception (expensive stack capture) on 99.99% of calls.
  let triggered = false;

  if (lastMessage.includes('snapview_capture')) {
    // Signal keyword found — try structured parse for exact match
    try {
      const parsed = JSON.parse(lastMessage);
      if (parsed && parsed.snapview_capture === true) {
        triggered = true;
      }
    } catch {
      // Not pure JSON — check for embedded signal substring
      if (lastMessage.includes('{"snapview_capture":true')) {
        triggered = true;
      }
    }
  }

  if (!triggered) {
    // No trigger signal — exit silently, let Claude continue
    process.exit(0);
  }

  // Trigger detected — run the snapview binary
  let filePath;
  try {
    const stdout = execFileSync('snapview', ['--auto-trigger'], { timeout: 32000, encoding: 'utf8' });
    filePath = stdout.trim();
  } catch (err) {
    // Check if it was a user cancel (exit code 2)
    if (err.status === 2) {
      // User cancelled — exit silently, no block
      process.exit(0);
    }

    // Error or timeout — exit silently, don't disrupt Claude's response.
    // The capture was a background enhancement; failure shouldn't interrupt the conversation.
    process.exit(0);
  }

  // Success — block Claude and inject file path instruction
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: 'Screenshot captured. Read the file at: ' + filePath + ' and continue the conversation with the screenshot in context.'
  }) + '\n');
  process.exit(0);
});
