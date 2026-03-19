#!/usr/bin/env node
'use strict';

// ─── Node version check ───────────────────────────────────────────────────────
// parseInt stops at the first non-numeric char (the dot), extracting the major version
// with zero array allocations (vs split('.').map(Number))
const major = parseInt(process.versions.node, 10);
if (major < 18) {
  process.stderr.write(
    `[snapview] Node.js 18 or later is required (you have ${process.versions.node}).\n` +
    `[snapview] Download the latest LTS from https://nodejs.org/\n`
  );
  process.exit(1);
}

const args = process.argv.slice(2);

// ─── Subcommand routing ─────────────────────────────────────────────────────
// Handle install/uninstall before loading Electron (which is heavy)
if (args.length > 0 && args[0] === 'install') {
  const { install } = require('../scripts/postinstall.cjs');
  install();
  process.exit(0);
}

if (args.length > 0 && args[0] === 'uninstall') {
  const { uninstall } = require('../scripts/postinstall.cjs');
  uninstall();
  process.exit(0);
}

// ─── Default: Launch Electron capture UI ────────────────────────────────────
const { spawn } = require('child_process');
const path = require('path');

// require('electron') returns the path to the Electron binary
const electronPath = require('electron');

// Point to the built main process entry point (electron-vite output)
const appPath = path.join(__dirname, '..', 'out', 'main', 'index.js');

// Forward CLI args to the Electron process (after stripping node + script path)
const child = spawn(electronPath, [appPath, ...args], {
  // stdin + stderr inherited; stdout piped so we can capture the file path output
  stdio: ['inherit', 'pipe', 'inherit'],
});

// Forward Electron's stdout to our stdout (file path comes through here)
child.stdout.on('data', (data) => process.stdout.write(data));

// Mirror the Electron process exit code
child.on('exit', (code) => process.exit(code ?? 0));

// Handle spawn errors (e.g., electron binary not found)
child.on('error', (err) => {
  process.stderr.write(`[snapview] Failed to start Electron: ${err.message}\n`);
  process.exit(1);
});
