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
 * Install snapview skill and hooks into ~/.claude/.
 * Idempotent — safe to run multiple times.
 */
function install() {
  // Check Claude Code is installed (dir OR binary must exist)
  const dirExists = fs.existsSync(CLAUDE_DIR);
  const binaryExists = isClaudeInPath();

  if (!dirExists && !binaryExists) {
    process.stderr.write('Claude Code not detected. Install Claude Code first, then re-run.\n');
    process.exit(1);
  }

  // If binary found but dir doesn't exist, create it
  if (!dirExists) {
    fs.mkdirSync(CLAUDE_DIR, { recursive: true });
  }

  // Create skills directory and copy SKILL.md template
  fs.mkdirSync(SKILLS_DIR, { recursive: true });
  const skillTemplatePath = path.join(__dirname, '..', 'claude-integration', 'SKILL.md');
  const skillContent = fs.readFileSync(skillTemplatePath, 'utf8');
  fs.writeFileSync(SKILL_PATH, skillContent, 'utf8');

  // Create hooks directory and copy hook script
  fs.mkdirSync(HOOKS_DIR, { recursive: true });
  const hookSourcePath = path.join(__dirname, 'snapview-autotrigger.js');
  const hookContent = fs.readFileSync(hookSourcePath, 'utf8');
  fs.writeFileSync(HOOK_PATH, hookContent, 'utf8');

  // Make executable on non-Windows platforms
  if (process.platform !== 'win32') {
    fs.chmodSync(HOOK_PATH, 0o755);
  }

  // Read-modify-write settings.json
  let settings = {};
  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    } catch {
      // Malformed settings.json — start fresh but preserve file by overwriting
      settings = {};
    }
  }

  // Ensure hooks structure exists
  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.Stop) settings.hooks.Stop = [];

  // Remove any existing snapview entry (idempotent)
  settings.hooks.Stop = settings.hooks.Stop.filter(
    (entry) => !JSON.stringify(entry).includes('snapview-autotrigger')
  );

  // Compute hook command path with forward slashes (Windows compatibility per Pitfall 4)
  const hookCommandPath = HOOK_PATH.replace(/\\/g, '/');

  // Add the new snapview hook entry
  settings.hooks.Stop.push({
    hooks: [
      {
        type: 'command',
        command: 'node ' + hookCommandPath,
        timeout: 35,
      },
    ],
  });

  // Ensure env section exists and set the auto-trigger toggle (enabled by default)
  if (!settings.env) settings.env = {};
  settings.env.SNAPVIEW_AUTO_TRIGGER = '1';

  // Write back with trailing newline
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'utf8');

  console.log('Snapview installed successfully!');
}

/**
 * Remove snapview skill and hooks from ~/.claude/.
 */
function uninstall() {
  // Remove skill directory
  fs.rmSync(SKILLS_DIR, { recursive: true, force: true });

  // Remove hook file
  fs.rmSync(HOOK_PATH, { force: true });

  // Read-modify-write settings.json — remove snapview entries
  if (fs.existsSync(SETTINGS_PATH)) {
    let settings;
    try {
      settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    } catch {
      // Malformed or missing — nothing to clean up
      settings = null;
    }

    if (settings) {
      // Remove snapview hook entries from Stop array
      if (settings.hooks && Array.isArray(settings.hooks.Stop)) {
        settings.hooks.Stop = settings.hooks.Stop.filter(
          (entry) => !JSON.stringify(entry).includes('snapview-autotrigger')
        );

        // Clean up empty keys
        if (settings.hooks.Stop.length === 0) {
          delete settings.hooks.Stop;
        }
        if (Object.keys(settings.hooks).length === 0) {
          delete settings.hooks;
        }
      }

      // Remove the auto-trigger env var
      if (settings.env && 'SNAPVIEW_AUTO_TRIGGER' in settings.env) {
        delete settings.env.SNAPVIEW_AUTO_TRIGGER;

        if (Object.keys(settings.env).length === 0) {
          delete settings.env;
        }
      }

      // Write back with trailing newline
      fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'utf8');
    }
  }

  console.log('Snapview uninstalled successfully!');
}

// Auto-run install when executed directly (npm postinstall)
if (require.main === module) {
  install();
}

module.exports = { install, uninstall };
