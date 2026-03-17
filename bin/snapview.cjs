#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const path = require('path');

// require('electron') returns the path to the Electron binary
const electronPath = require('electron');

// Point to the built main process entry point (electron-vite output)
const appPath = path.join(__dirname, '..', 'out', 'main', 'index.js');

// Forward CLI args to the Electron process (after stripping node + script path)
const child = spawn(electronPath, [appPath, ...process.argv.slice(2)], {
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
