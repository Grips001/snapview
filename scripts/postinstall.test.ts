/**
 * Unit tests for scripts/postinstall.cjs
 *
 * Strategy: Since postinstall.cjs uses os.homedir() at module-load time
 * (module-level constants), we cannot mock it via require(). Instead, we
 * spawn node child processes with HOME/USERPROFILE overridden to a temp
 * directory, then assert file system state. This tests the real code path.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';

// Absolute path to postinstall.cjs
const POSTINSTALL_PATH = path.join(import.meta.dir, 'postinstall.cjs');
// Absolute path to SKILL.md template
const SKILL_TEMPLATE_PATH = path.join(import.meta.dir, '..', 'claude-integration', 'SKILL.md');

let tmpDir: string;
let claudeDir: string;

/**
 * Run postinstall.cjs install() in a child process with HOME overridden.
 * Returns { status, stderr }.
 */
function runInstall(home: string): { status: number; stderr: string } {
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  // Strip CI vars so postinstall doesn't short-circuit in GitHub Actions
  delete env.CI;
  delete env.GITHUB_ACTIONS;
  const result = spawnSync(
    process.execPath,
    ['-e', `process.env.HOME = process.env.USERPROFILE = '${home.replace(/\\/g, '/')}'; require('${POSTINSTALL_PATH.replace(/\\/g, '/')}').install()`],
    { encoding: 'utf8', env }
  );
  return { status: result.status ?? 1, stderr: result.stderr ?? '' };
}

/**
 * Run postinstall.cjs uninstall() in a child process with HOME overridden.
 */
function runUninstall(home: string): { status: number; stderr: string } {
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  delete env.CI;
  delete env.GITHUB_ACTIONS;
  const result = spawnSync(
    process.execPath,
    ['-e', `process.env.HOME = process.env.USERPROFILE = '${home.replace(/\\/g, '/')}'; require('${POSTINSTALL_PATH.replace(/\\/g, '/')}').uninstall()`],
    { encoding: 'utf8', env }
  );
  return { status: result.status ?? 1, stderr: result.stderr ?? '' };
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snapview-test-'));
  claudeDir = path.join(tmpDir, '.claude');
  // Create .claude dir to simulate Claude Code is installed
  fs.mkdirSync(claudeDir, { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('install()', () => {
  test('creates SKILL.md in skills/snapview/', () => {
    const result = runInstall(tmpDir);
    expect(result.status).toBe(0);

    const skillPath = path.join(claudeDir, 'skills', 'snapview', 'SKILL.md');
    expect(fs.existsSync(skillPath)).toBe(true);

    // Content matches the template
    const written = fs.readFileSync(skillPath, 'utf8');
    const template = fs.readFileSync(SKILL_TEMPLATE_PATH, 'utf8');
    expect(written).toBe(template);
  });

  test('creates hooks/snapview-autotrigger.js', () => {
    const result = runInstall(tmpDir);
    expect(result.status).toBe(0);

    const hookPath = path.join(claudeDir, 'hooks', 'snapview-autotrigger.js');
    expect(fs.existsSync(hookPath)).toBe(true);
  });

  test('creates settings.json with Stop hook entry containing snapview-autotrigger', () => {
    const result = runInstall(tmpDir);
    expect(result.status).toBe(0);

    const settingsPath = path.join(claudeDir, 'settings.json');
    expect(fs.existsSync(settingsPath)).toBe(true);

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    expect(settings.hooks).toBeDefined();
    expect(Array.isArray(settings.hooks.Stop)).toBe(true);

    const hasSnapviewHook = settings.hooks.Stop.some((entry: unknown) =>
      JSON.stringify(entry).includes('snapview-autotrigger')
    );
    expect(hasSnapviewHook).toBe(true);
  });

  test('hook command path is quoted for spaces in paths', () => {
    runInstall(tmpDir);

    const settingsPath = path.join(claudeDir, 'settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

    const snapviewEntry = settings.hooks.Stop.find((entry: unknown) =>
      JSON.stringify(entry).includes('snapview-autotrigger')
    );
    const command = snapviewEntry.hooks[0].command;
    // Path portion must be wrapped in double quotes
    expect(command).toMatch(/^node ".*snapview-autotrigger\.js"$/);
  });

  test('sets SNAPVIEW_AUTO_TRIGGER=1 in settings.json env', () => {
    runInstall(tmpDir);

    const settingsPath = path.join(claudeDir, 'settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    expect(settings.env).toBeDefined();
    expect(settings.env.SNAPVIEW_AUTO_TRIGGER).toBe('1');
  });

  test('preserves existing settings.json entries', () => {
    // Write a pre-existing settings.json with some existing keys
    const settingsPath = path.join(claudeDir, 'settings.json');
    const existing = {
      myExistingKey: true,
      hooks: {
        UserPromptSubmit: [
          {
            hooks: [{ type: 'command', command: 'other-hook.sh' }],
          },
        ],
      },
    };
    fs.writeFileSync(settingsPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');

    runInstall(tmpDir);

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

    // Existing key preserved
    expect(settings.myExistingKey).toBe(true);

    // Existing UserPromptSubmit hook preserved
    expect(settings.hooks.UserPromptSubmit).toBeDefined();
    expect(settings.hooks.UserPromptSubmit.length).toBe(1);
    expect(settings.hooks.UserPromptSubmit[0].hooks[0].command).toBe('other-hook.sh');
  });

  test('is idempotent — running twice produces exactly one snapview hook entry', () => {
    runInstall(tmpDir);
    runInstall(tmpDir);

    const settingsPath = path.join(claudeDir, 'settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

    const snapviewEntries = settings.hooks.Stop.filter((entry: unknown) =>
      JSON.stringify(entry).includes('snapview-autotrigger')
    );
    // idempotent: exactly one entry even after double install
    expect(snapviewEntries.length).toBe(1);
  });
});

describe('uninstall()', () => {
  test('removes skills/snapview/ directory', () => {
    runInstall(tmpDir);

    const skillDir = path.join(claudeDir, 'skills', 'snapview');
    expect(fs.existsSync(skillDir)).toBe(true);

    runUninstall(tmpDir);
    expect(fs.existsSync(skillDir)).toBe(false);
  });

  test('removes hooks/snapview-autotrigger.js file', () => {
    runInstall(tmpDir);

    const hookPath = path.join(claudeDir, 'hooks', 'snapview-autotrigger.js');
    expect(fs.existsSync(hookPath)).toBe(true);

    runUninstall(tmpDir);
    expect(fs.existsSync(hookPath)).toBe(false);
  });

  test('removes snapview hook from settings.json Stop array', () => {
    runInstall(tmpDir);
    runUninstall(tmpDir);

    const settingsPath = path.join(claudeDir, 'settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

    // Stop array should not exist or be empty of snapview entries
    if (settings.hooks && Array.isArray(settings.hooks.Stop)) {
      const snapviewEntries = settings.hooks.Stop.filter((entry: unknown) =>
        JSON.stringify(entry).includes('snapview-autotrigger')
      );
      expect(snapviewEntries.length).toBe(0);
    } else {
      // Stop key was removed — that's fine too
      expect(true).toBe(true);
    }
  });

  test('preserves non-snapview entries in settings.json', () => {
    // Write settings with an existing non-snapview hook
    const settingsPath = path.join(claudeDir, 'settings.json');
    const existing = {
      keepMe: 'yes',
      hooks: {
        UserPromptSubmit: [
          {
            hooks: [{ type: 'command', command: 'other-hook.sh' }],
          },
        ],
      },
    };
    fs.writeFileSync(settingsPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');

    runInstall(tmpDir);
    runUninstall(tmpDir);

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

    // Pre-existing non-snapview data preserved
    expect(settings.keepMe).toBe('yes');
    expect(settings.hooks.UserPromptSubmit).toBeDefined();
    expect(settings.hooks.UserPromptSubmit[0].hooks[0].command).toBe('other-hook.sh');
  });
});
