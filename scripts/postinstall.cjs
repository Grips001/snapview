'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const SETTINGS_PATH = path.join(CLAUDE_DIR, 'settings.json');
const SKILLS_DIR = path.join(CLAUDE_DIR, 'skills', 'snapview');
const SKILL_PATH = path.join(SKILLS_DIR, 'SKILL.md');
const HOOKS_DIR = path.join(CLAUDE_DIR, 'hooks');
const HOOK_FILENAME = 'snapview-autotrigger.js';
const HOOK_PATH = path.join(HOOKS_DIR, HOOK_FILENAME);

/**
 * Filter predicate: returns true for hook entries NOT belonging to snapview.
 * Single source of truth — used by both install (idempotent cleanup) and uninstall.
 */
function isNotSnapviewHook(entry) {
  const hooks = entry.hooks || [];
  return !hooks.some(h => h.command && h.command.includes('snapview-autotrigger'));
}

/**
 * Check whether the Claude Code binary is in PATH.
 * Returns true if found, false otherwise.
 */
function isClaudeInPath() {
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  try {
    execFileSync(cmd, ['claude'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Read and parse settings.json, returning empty object on any failure.
 */
function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Write settings object back to settings.json with trailing newline.
 */
function writeSettings(settings) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'utf8');
}

/**
 * Install snapview skill and hooks into ~/.claude/.
 * Idempotent — safe to run multiple times.
 */
function install() {
  // Check Claude Code is installed (dir OR binary must exist)
  // Short-circuit: skip expensive PATH lookup if dir already exists
  const dirExists = fs.existsSync(CLAUDE_DIR);
  if (!dirExists && !isClaudeInPath()) {
    process.stderr.write('Claude Code not detected. Install Claude Code first, then re-run: snapview install\n');
    process.exit(0); // Exit cleanly — don't break npm install
  }

  // Ensure directories exist
  fs.mkdirSync(SKILLS_DIR, { recursive: true });
  fs.mkdirSync(HOOKS_DIR, { recursive: true });

  // Copy files — single syscall each via copyFileSync (vs read+write = 2 syscalls)
  fs.copyFileSync(path.join(__dirname, '..', 'claude-integration', 'SKILL.md'), SKILL_PATH);
  fs.copyFileSync(path.join(__dirname, 'snapview-autotrigger.js'), HOOK_PATH);

  // Make hook executable on non-Windows platforms
  if (process.platform !== 'win32') {
    fs.chmodSync(HOOK_PATH, 0o755);
  }

  // Read-modify-write settings.json
  const settings = readSettings();

  // Ensure hooks structure exists
  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.Stop) settings.hooks.Stop = [];

  // Remove any existing snapview entry (idempotent)
  settings.hooks.Stop = settings.hooks.Stop.filter(isNotSnapviewHook);

  // Compute hook command path with forward slashes (Windows compatibility)
  const hookCommandPath = HOOK_PATH.replace(/\\/g, '/');

  // Add the new snapview hook entry
  settings.hooks.Stop.push({
    hooks: [
      {
        type: 'command',
        command: 'node "' + hookCommandPath + '"',
        timeout: 35,
      },
    ],
  });

  // Ensure env section exists and set the auto-trigger toggle (enabled by default)
  if (!settings.env) settings.env = {};
  settings.env.SNAPVIEW_AUTO_TRIGGER = '1';

  writeSettings(settings);

  console.log('Snapview installed successfully!');
}

/**
 * Remove snapview skill and hooks from ~/.claude/.
 */
function uninstall() {
  // Remove skill directory and hook file
  fs.rmSync(SKILLS_DIR, { recursive: true, force: true });
  fs.rmSync(HOOK_PATH, { force: true });

  // Read-modify-write settings.json — remove snapview entries
  if (!fs.existsSync(SETTINGS_PATH)) return console.log('Snapview uninstalled successfully!');

  const settings = readSettings();
  if (!settings || typeof settings !== 'object') return console.log('Snapview uninstalled successfully!');

  // Remove snapview hook entries from Stop array
  if (settings.hooks && Array.isArray(settings.hooks.Stop)) {
    settings.hooks.Stop = settings.hooks.Stop.filter(isNotSnapviewHook);

    // Clean up empty keys
    if (settings.hooks.Stop.length === 0) delete settings.hooks.Stop;
    if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
  }

  // Remove the auto-trigger env var
  if (settings.env && 'SNAPVIEW_AUTO_TRIGGER' in settings.env) {
    delete settings.env.SNAPVIEW_AUTO_TRIGGER;
    if (Object.keys(settings.env).length === 0) delete settings.env;
  }

  writeSettings(settings);

  console.log('Snapview uninstalled successfully!');
}

// Auto-run install when executed directly (npm postinstall)
if (require.main === module) {
  // In CI, skip — Claude Code won't be installed
  if (process.env.CI || process.env.GITHUB_ACTIONS) {
    process.exit(0);
  }
  install();
}

module.exports = { install, uninstall };
