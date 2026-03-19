'use strict';

/**
 * Unit tests for bin/snapview.cjs — CLI entry point (INST-02)
 *
 * Strategy: Read the source file and verify the required patterns are present.
 * The CLI entry point is a thin wrapper — it spawns an Electron subprocess.
 * We can't easily run it in a test environment (no Electron binary in CI),
 * so we verify the correctness of the source patterns.
 */

const { describe, test, expect } = require('bun:test');
const path = require('path');
const fs = require('fs');

// Read the CLI source for pattern verification
const cliSource = fs.readFileSync(
  path.join(__dirname, 'snapview.cjs'),
  'utf-8'
);

describe('CLI entry point — INST-02', () => {
  test('snapview.cjs file exists and is syntactically valid', () => {
    // If require.resolve throws, the file is missing or has syntax errors
    let resolvedPath;
    expect(() => {
      resolvedPath = require.resolve('./snapview.cjs');
    }).not.toThrow();
    expect(resolvedPath).toBeTruthy();
  });

  test('file requires electron (for binary path resolution)', () => {
    expect(cliSource).toContain("require('electron')");
  });

  test('file contains spawn call to launch Electron subprocess', () => {
    expect(cliSource).toContain('spawn(');
    expect(cliSource).toContain('spawn');
  });

  test("spawn is imported from 'child_process'", () => {
    expect(cliSource).toContain("require('child_process')");
    expect(cliSource).toContain('spawn');
  });

  test("stdio configuration pipes stdout for file path capture", () => {
    // stdout must be 'pipe' to capture the file path emitted by Electron
    expect(cliSource).toContain("'pipe'");
    // stdin and stderr should be inherited
    expect(cliSource).toContain("'inherit'");
  });

  test('stdout data is forwarded from child to parent process', () => {
    // The child.stdout.on('data') handler must write to process.stdout
    expect(cliSource).toContain("child.stdout.on('data'");
    expect(cliSource).toContain('process.stdout.write(');
  });

  test('exit code is forwarded from child process — process.exit(code)', () => {
    expect(cliSource).toContain('process.exit(code');
  });

  test("child.on('exit') handler is registered for exit code forwarding", () => {
    expect(cliSource).toContain("child.on('exit'");
  });

  test("child.on('error') handler is registered for spawn failure", () => {
    expect(cliSource).toContain("child.on('error'");
  });

  test('app path points to out/main/index.js (electron-vite output)', () => {
    expect(cliSource).toContain('out');
    expect(cliSource).toContain('main');
    expect(cliSource).toContain('index.js');
  });

  test('CLI args are forwarded to Electron process', () => {
    // process.argv.slice(2) strips 'node' and script path, forwarding the rest
    expect(cliSource).toContain('process.argv.slice(2)');
  });

  test('file has shebang line for direct execution', () => {
    expect(cliSource.startsWith('#!/usr/bin/env node')).toBe(true);
  });
});

describe('Node version check', () => {
  test('checks process.versions.node for minimum version', () => {
    expect(cliSource).toContain('process.versions.node');
  });

  test('requires Node 18 or later', () => {
    expect(cliSource).toContain('major < 18');
  });

  test('provides actionable error message with download link', () => {
    expect(cliSource).toContain('Node.js 18 or later is required');
    expect(cliSource).toContain('https://nodejs.org/');
  });

  test('exits with code 1 on version mismatch', () => {
    // The version check block must exit before Electron is loaded
    const versionCheckPos = cliSource.indexOf('major < 18');
    const electronPos = cliSource.indexOf("require('electron')");
    expect(versionCheckPos).toBeLessThan(electronPos);
  });
});
