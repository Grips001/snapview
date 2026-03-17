#!/usr/bin/env node
'use strict';

const { execFileSync } = require('child_process');
const process = require('process');

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

  // Check for trigger signal — two approaches:
  // 1. Attempt to parse last_assistant_message as JSON and check for snapview_capture key
  // 2. Scan for the JSON signal as a substring (Claude may embed it within prose)
  let triggered = false;

  // Method 1: Try to parse full message as JSON
  try {
    const parsed = JSON.parse(lastMessage);
    if (parsed && parsed.snapview_capture === true) {
      triggered = true;
    }
  } catch {
    // Not pure JSON — try substring scan below
  }

  // Method 2: Substring scan for the signal pattern
  if (!triggered && lastMessage.includes('{"snapview_capture":true')) {
    triggered = true;
  }

  if (!triggered) {
    // No trigger signal — exit silently, let Claude continue
    process.exit(0);
  }

  // Trigger detected — run the snapview binary
  let filePath;
  try {
    const stdout = execFileSync('snapview', [], { timeout: 32000, encoding: 'utf8' });
    filePath = stdout.trim();
  } catch (err) {
    // Check if it was a user cancel (exit code 2)
    if (err.status === 2) {
      // User cancelled — exit silently, no block
      process.exit(0);
    }

    // Error or timeout — block Claude with failure reason
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason: 'Screenshot capture failed or timed out. Continue without the screenshot.'
    }) + '\n');
    process.exit(0);
  }

  // Success — block Claude and inject file path instruction
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: 'Screenshot captured. Read the file at: ' + filePath + ' and continue the conversation with the screenshot in context.'
  }) + '\n');
  process.exit(0);
});
