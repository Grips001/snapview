/**
 * Unit tests for scripts/snapview-autotrigger.js
 *
 * Strategy: Spawn the hook script as a child process with controlled stdin and
 * environment, then assert stdout and exit code. For tests requiring the
 * snapview binary, create a tiny mock script in a temp dir and prepend it to PATH.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const HOOK_SCRIPT = path.join(import.meta.dir, 'snapview-autotrigger.js');

let tmpDir: string;

/**
 * Run the hook script with given stdin input and env overrides.
 * Returns { stdout, stderr, status }.
 */
function runHook(
  input: string,
  env: Record<string, string | undefined> = {}
): { stdout: string; stderr: string; status: number } {
  const result = spawnSync(process.execPath, [HOOK_SCRIPT], {
    input,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    timeout: 5000,
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status ?? 1,
  };
}

/**
 * Create a mock snapview binary in tmpDir that exits with given code
 * and optionally prints a file path.
 */
function createMockSnapview(exitCode: number, output = ''): string {
  const binDir = path.join(tmpDir, 'bin');
  fs.mkdirSync(binDir, { recursive: true });

  const isWindows = process.platform === 'win32';
  let scriptPath: string;

  if (isWindows) {
    // On Windows, create a .cmd wrapper that calls a .js file
    const jsPath = path.join(binDir, 'snapview.js');
    scriptPath = path.join(binDir, 'snapview.cmd');
    const jsContent = output
      ? `process.stdout.write('${output}\\n'); process.exit(${exitCode});`
      : `process.exit(${exitCode});`;
    fs.writeFileSync(jsPath, jsContent, 'utf8');
    fs.writeFileSync(scriptPath, `@node "${jsPath}" %*\r\n`, 'utf8');
  } else {
    scriptPath = path.join(binDir, 'snapview');
    const script = output
      ? `#!/bin/sh\nprintf '${output}\\n'\nexit ${exitCode}\n`
      : `#!/bin/sh\nexit ${exitCode}\n`;
    fs.writeFileSync(scriptPath, script, 'utf8');
    fs.chmodSync(scriptPath, 0o755);
  }

  return binDir;
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snapview-hook-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('snapview-autotrigger', () => {
  test('exits 0 with no output when SNAPVIEW_AUTO_TRIGGER is not set', () => {
    const input = JSON.stringify({
      last_assistant_message: '{"snapview_capture":true}',
      hook_event_name: 'Stop',
    });

    const result = runHook(input, { SNAPVIEW_AUTO_TRIGGER: undefined });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  test('exits 0 with no output when last_assistant_message has no trigger signal', () => {
    const input = JSON.stringify({
      last_assistant_message: 'Hello, how can I help you today?',
      hook_event_name: 'Stop',
    });

    const result = runHook(input, { SNAPVIEW_AUTO_TRIGGER: '1' });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  test('outputs decision:block when last_assistant_message contains snapview_capture signal', () => {
    const mockFilePath = '/tmp/snapview-test-capture.png';
    const binDir = createMockSnapview(0, mockFilePath);
    const originalPath = process.env.PATH ?? '';
    const newPath = `${binDir}${path.delimiter}${originalPath}`;

    const input = JSON.stringify({
      last_assistant_message: '{"snapview_capture":true,"reason":"test"}',
      hook_event_name: 'Stop',
    });

    const result = runHook(input, {
      SNAPVIEW_AUTO_TRIGGER: '1',
      PATH: newPath,
    });

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed.decision).toBe('block');
    expect(parsed.reason).toContain(mockFilePath);
  });

  test('exits 0 silently when snapview exits with code 2 (user cancelled)', () => {
    const binDir = createMockSnapview(2, '');
    const originalPath = process.env.PATH ?? '';
    const newPath = `${binDir}${path.delimiter}${originalPath}`;

    const input = JSON.stringify({
      last_assistant_message: '{"snapview_capture":true}',
      hook_event_name: 'Stop',
    });

    const result = runHook(input, {
      SNAPVIEW_AUTO_TRIGGER: '1',
      PATH: newPath,
    });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  test('passes --auto-trigger flag to snapview binary', () => {
    const hookSource = fs.readFileSync(HOOK_SCRIPT, 'utf-8');
    expect(hookSource).toContain("'--auto-trigger'");
  });

  test('exits silently when snapview exits with code 1 (error) — does not block Claude', () => {
    const binDir = createMockSnapview(1, '');
    const originalPath = process.env.PATH ?? '';
    const newPath = `${binDir}${path.delimiter}${originalPath}`;

    const input = JSON.stringify({
      last_assistant_message: '{"snapview_capture":true}',
      hook_event_name: 'Stop',
    });

    const result = runHook(input, {
      SNAPVIEW_AUTO_TRIGGER: '1',
      PATH: newPath,
    });

    // Failure should NOT block Claude — exit silently, no stdout output
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });
});
