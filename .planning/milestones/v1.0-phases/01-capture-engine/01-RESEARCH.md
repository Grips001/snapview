# Phase 1: Capture Engine - Research

**Researched:** 2026-03-16
**Domain:** Electron cross-platform screen capture — overlay UI, region selection, PNG output to OS temp directory
**Confidence:** HIGH (core Electron APIs verified against official docs; pitfalls cross-referenced against GitHub issues)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Overlay interaction:** Medium dim (40-50%) — macOS-style subtle darkening, not heavy Windows Snipping Tool contrast
- **Region display:** Selected region shows as a clear cutout at full brightness with a subtle border for precision
- **No live dimension tooltip** during drag — keep the overlay clean
- **Hint text:** Small "Drag to select / ESC to cancel" — visible but unobtrusive
- **Overlay scope:** Active monitor only (where cursor is at launch), not all monitors
- **No resize handles:** Mouse-up commits the selection; user retakes from preview if wrong
- **Preview:** Must include approve and retake options — exact UX is flexible
- **Stdout contract:** stdout must be cleanly parseable by hooks/scripts — no mixed human/machine output on stdout
- **Project structure:** Follow latest documented best practices for electron-vite; npm package name is `snapview`
- **Electron version:** Pin to 35.x (avoid known Linux cursor regression bugs in v36+). See note below on version update.

### Claude's Discretion

- Cursor style during selection (standard crosshair vs custom full-screen crosshair)
- Click-without-drag behavior (cancel vs capture full screen)
- Preview window placement and button design
- Keyboard shortcut assignments in preview
- Image scaling in preview (fit-to-window vs actual size)
- Stdout output format and exit code conventions
- Stderr logging strategy
- CLI flags for Phase 1
- macOS permission denial UX (dialog vs toast)
- Selection border color/style
- TypeScript configuration
- License (default to MIT per JS ecosystem convention)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CAPT-01 | User can trigger a fullscreen dimmed overlay for screen region selection | Pattern 2: Transparent Fullscreen Overlay Window; BrowserWindow transparent + fullscreen config |
| CAPT-02 | User can drag-to-select a rectangular screen region with crosshair cursor | Canvas mousedown/mousemove/mouseup rubber-band pattern; CSS cursor: crosshair |
| CAPT-03 | User sees a preview of the captured region with "Send to Claude" and "Retake" options | Preview panel in renderer; nativeImage.crop() for preview generation |
| CAPT-04 | User can press ESC at any point to cancel capture and return to Claude | keydown ESC handler in renderer + IPC cancel channel; app.quit() in main |
| CAPT-05 | Captured image is saved as PNG to OS temp directory with unique filename | fs/promises write to os.tmpdir()/snapview/; nativeImage.toPNG() |
| FILE-01 | Screenshots written to os.tmpdir()/snapview/ with timestamp+random filenames | crypto.randomBytes() for uniqueness; os.tmpdir() for cross-platform temp path |
| PLAT-01 | macOS screen recording permission checked before capture attempt (no silent hang) | systemPreferences.getMediaAccessStatus('screen') gate before getSources() |
| PLAT-02 | Linux overlay uses correct GPU flags for transparency on X11/NVIDIA | --enable-transparent-visuals --disable-gpu via app.commandLine.appendSwitch() |
| PLAT-03 | Electron process has hard-exit timeout to prevent Claude Code hook hang | setTimeout(() => app.quit(), 30000) as backstop in main process |
| PLAT-04 | Overlay appears on correct monitor in multi-monitor setups | screen.getCursorScreenPoint() to identify active display; bounds-scoped BrowserWindow |
| PLAT-05 | macOS Sequoia monthly permission re-prompt handled gracefully | Check getMediaAccessStatus() every launch, not just first run; user-visible messaging |
| PLAT-06 | Basic Wayland fallback support (X11 primary) | try/catch around getSources() on Wayland; process.on('uncaughtException') for portal crash |
| INST-02 | All dependencies (Electron) bundled — no external tools required | electron npm package bundles binary; desktopCapturer replaces OS tools |
| INST-03 | Works on Windows, macOS, and Linux out of the box | Electron cross-platform runtime; platform-gated flags for Linux |

</phase_requirements>

---

## Summary

Phase 1 builds the complete Electron-based capture engine: a transparent fullscreen overlay window on the active monitor, a canvas-based rubber-band drag selection UI, a preview panel with approve/retake, and PNG output to `os.tmpdir()/snapview/` with the file path emitted to stdout. This is a greenfield project — no existing code to integrate with.

The architecture is established by prior project research and is well-understood: a thin CommonJS CLI entry point (`bin/snapview.cjs`) spawns the Electron binary via `require('electron')`, the Electron main process creates the overlay `BrowserWindow`, communicates with the renderer via IPC through a preload `contextBridge`, and the renderer handles all user interaction. The main process calls `desktopCapturer.getSources({ types: ['screen'] })`, passes the thumbnail to the renderer for the overlay background and live crop preview, and writes the final PNG after the user approves.

Three platform-specific risks are architectural, not cosmetic, and must be handled from day one: (1) macOS screen recording permission silent hang — always call `systemPreferences.getMediaAccessStatus('screen')` before `getSources()`; (2) Linux transparent overlay failure on X11/NVIDIA — apply `--enable-transparent-visuals --disable-gpu` switches on Linux; (3) all exit paths (ESC, retake, approve, hard timeout) must call `app.quit()` cleanly. These cannot be retrofitted — they determine the structure of the capture flow.

**Primary recommendation:** Use Electron 35.7.5 (not the just-released 41.x) with electron-vite 5.x, TypeScript 5.x, and vanilla TS in the renderer (no UI framework). All capture and image operations use Electron built-ins — no external image libraries needed for Phase 1.

---

## Version Note: Electron 35.x vs 41.x

Prior research pinned to Electron 35.x due to Linux cursor regression bugs in v36+. As of 2026-03-13, Electron 41.0.2 is the latest stable release. **The pin to 35.x remains the right choice for Phase 1** because:

1. Electron 41.x was released 3 days ago (2026-03-13). There has been no community validation time for Linux-specific behaviors.
2. The project's own research explicitly flags the `screen.getCursorScreenPoint()` regression as unresolved across v29-v38. Electron 40.x and 41.x are too new to have community confirmation this is fixed.
3. Electron 35.7.5 (released 2025-03-04, mature LTS-equivalent) is the established stable anchor.
4. The decision can be revisited after the Linux regression is confirmed resolved — upgrade is non-breaking.

**Verified versions for Phase 1:**

| Package | Version to Use | Latest Available | Notes |
|---------|---------------|-----------------|-------|
| electron | 35.7.5 | 41.0.2 | Pin to 35.x for Linux stability |
| electron-vite | 5.0.0 | 5.0.0 | Current stable |
| electron-builder | 26.8.1 | 26.8.1 | Current stable |
| typescript | 5.9.3 | 5.9.3 | Current stable |
| commander | 14.0.3 | 14.0.3 | Note: was 12.x in prior research, now 14.x |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| electron | 35.7.5 | Cross-platform desktop runtime — Chromium + Node bundled | Eliminates OS-specific screenshot tool dependencies; single `npm i -g` install works on all platforms |
| typescript | 5.9.3 | Type safety across main/renderer/preload | IPC contract mismatches are the #1 source of Electron bugs; TS catches them at compile time |
| electron-vite | 5.0.0 | Build tooling (Vite-based, understands Electron's split environment) | Handles main/renderer/preload build natively; sub-second HMR in dev; simpler config than raw Vite+plugins |
| commander | 14.0.3 | CLI argument parsing in the Node.js entry point | Lightweight; `yargs` is overkill for a single-purpose CLI; `minimist` has no TypeScript types |

### Electron Built-ins (no additional install)

| API | Purpose | Why Not External |
|-----|---------|-----------------|
| `desktopCapturer` | Capture full screen frames from main process | The only correct cross-platform screen capture in Electron; `screenshot-desktop` shells out to OS tools |
| `nativeImage` | Crop captured frame to selected region, encode to PNG | `nativeImage.crop(rect).toPNG()` returns a Buffer — no `sharp` or `jimp` needed for v1 |
| `screen` | Get display geometry, DPI scale factor, cursor position | Required for multi-monitor targeting and pixel-coordinate conversion |
| `systemPreferences` | macOS screen recording permission check | Must be called before `desktopCapturer.getSources()` — not optional on macOS |
| `ipcMain` / `ipcRenderer` | Renderer ↔ main communication | All capture logic lives in main; renderer communicates only through the IPC bridge |
| `contextBridge` | Secure preload bridge | Required with `contextIsolation: true` (default in modern Electron) |
| `fs/promises` (Node built-in) | Write PNG buffer to OS temp dir | Standard Node API; no file writing library needed |
| `os` (Node built-in) | `os.tmpdir()` for cross-platform temp directory path | Returns `C:\Users\...\AppData\Local\Temp` on Windows, `/tmp` on Linux/macOS |
| `crypto` (Node built-in) | `crypto.randomBytes(8).toString('hex')` for unique filenames | Prevents filename collisions; avoids predictable paths (symlink attack mitigation) |

### Development Tools

| Tool | Purpose |
|------|---------|
| electron-builder 26.8.1 | Packages Electron for production distribution (ASAR bundling) |
| `bun` | Package manager per project convention (`bun install`, `bun run build`) |
| `tsc --noEmit` | Type checking only — electron-vite handles emit |

### Installation

```bash
# Core (runtime dependencies — bundled in the npm package)
bun add electron@35.7.5 commander@14.0.3

# Build tooling (dev only)
bun add -D electron-vite@5.0.0 electron-builder@26.8.1 typescript@5.9.3 @types/node
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| electron@35.7.5 | electron@41.0.2 | 41.x just released 3 days ago — insufficient Linux validation time. Revisit after community confirms Linux regressions resolved. |
| electron built-ins | `screenshot-desktop` npm | screenshot-desktop shells out to OS tools (scrot, screencapture) — breaks INST-02 "no external tools" constraint |
| `nativeImage` built-in | `sharp` | sharp adds ~50MB native dependency; nativeImage.crop() handles all Phase 1 crop needs |
| Vanilla TS renderer | React / Vue | UI is a single fullscreen canvas + preview modal — no component lifecycle needed; frameworks add bundle weight |
| `commander` | `yargs` | yargs is heavier; Phase 1 CLI has minimal flags; commander is the sweet spot |

---

## Architecture Patterns

### Recommended Project Structure

```
snapview/
├── bin/
│   └── snapview.cjs          # CLI entry point — locates electron binary, spawns app
├── src/
│   ├── main/
│   │   ├── index.ts          # Main process — window creation, IPC handlers, permission check
│   │   ├── capture.ts        # desktopCapturer wrapper, nativeImage crop, PNG write
│   │   └── cleanup.ts        # Startup sweep: delete temp files older than 24 hours
│   ├── renderer/
│   │   ├── index.html        # Overlay window shell
│   │   ├── app.ts            # Canvas region selector + preview UI
│   │   └── styles.css        # Transparent overlay, canvas positioning, preview layout
│   └── preload/
│       └── preload.ts        # contextBridge exposing capture/cancel channels
├── shared/
│   └── types.ts              # RegionRect, CaptureResult, AppState — safe to import in both main and renderer
├── package.json              # "bin": { "snapview": "bin/snapview.cjs" }, "main": "src/main/index.ts"
├── electron.vite.config.ts   # electron-vite build config
├── tsconfig.json             # Base TypeScript config
├── tsconfig.main.json        # "moduleResolution": "nodenext" for main process
└── tsconfig.renderer.json    # "moduleResolution": "bundler" for renderer
```

**Rationale:**
- `bin/` is the globally-installed CLI entry point — kept minimal (pure Node.js, no Electron imports)
- `src/main/` has zero renderer dependencies; capture logic in `capture.ts` is testable in isolation
- `src/renderer/` never imports from `electron` directly — preload bridge only
- `shared/types.ts` contains only plain types — no platform-specific imports — safe for both environments
- Separate `tsconfig` files per environment because `moduleResolution` differs (main = Node, renderer = Vite bundler)

### Pattern 1: CLI Entry Point Spawns Electron

The npm global binary is a thin CommonJS Node.js script. It calls `require('electron')` (which returns the Electron binary path) and `child_process.spawn()` to launch the Electron app with the app directory as the first argument.

```javascript
// bin/snapview.cjs
const { spawn } = require('child_process');
const electronPath = require('electron'); // returns path to binary
const path = require('path');

const appPath = path.join(__dirname, '..', 'out', 'main', 'index.js');
const child = spawn(electronPath, [appPath, ...process.argv.slice(2)], {
  stdio: ['inherit', 'pipe', 'inherit'],
});

// Forward Electron stdout to our stdout (this is where the file path comes through)
child.stdout.on('data', (data) => process.stdout.write(data));
child.on('exit', (code) => process.exit(code ?? 0));
```

**Key decisions in this pattern:**
- `stdio: ['inherit', 'pipe', 'inherit']` — stdin and stderr inherited; stdout piped so the file path can be captured and forwarded
- Do NOT use `execFileSync` — it blocks until exit and can cause timeout issues
- `appPath` points to the built output (`out/main/index.js` per electron-vite convention), not source
- Use `path.join(__dirname, '..')` — the `bin/` directory is one level below the package root

### Pattern 2: Transparent Fullscreen Overlay on Active Monitor

The overlay is a `BrowserWindow` scoped to the display containing the cursor at launch time.

```typescript
// src/main/index.ts
import { app, BrowserWindow, screen } from 'electron';
import path from 'path';

async function createOverlay(): Promise<BrowserWindow> {
  // Get the display where the cursor currently is
  const cursorPos = screen.getCursorScreenPoint();
  const activeDisplay = screen.getDisplayNearestPoint(cursorPos);
  const { x, y, width, height } = activeDisplay.bounds;

  const overlay = new BrowserWindow({
    x, y, width, height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    fullscreen: false,    // Use x/y/width/height instead of fullscreen:true for single-monitor targeting
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,      // Required for preload IPC — sandbox:true blocks ipcRenderer
    },
  });

  overlay.loadFile(path.join(__dirname, '../renderer/index.html'));
  return overlay;
}
```

**Why `fullscreen: false` with explicit `x/y/width/height`:** `fullscreen: true` covers the primary display regardless of which monitor the cursor is on. Setting explicit bounds from `screen.getDisplayNearestPoint(cursor)` achieves single-monitor overlay for PLAT-04.

**Why `alwaysOnTop: true` + `skipTaskbar: true`:** The overlay must appear above all windows; it must not appear in the taskbar/dock during the brief capture flow.

### Pattern 3: macOS Permission Gate (PLAT-01, PLAT-05)

This gate must run before any `desktopCapturer.getSources()` call. It is not optional.

```typescript
// src/main/capture.ts
import { systemPreferences, shell } from 'electron';

async function checkMacOSPermission(): Promise<'granted' | 'denied' | 'unavailable'> {
  if (process.platform !== 'darwin') return 'granted';

  const status = systemPreferences.getMediaAccessStatus('screen');

  if (status === 'granted') return 'granted';

  if (status === 'not-determined') {
    // Show the permission dialog — this opens System Preferences automatically
    const granted = await systemPreferences.askForMediaAccess('screen');
    return granted ? 'granted' : 'denied';
  }

  // status === 'denied' — permission was explicitly denied
  // Open System Settings so user can re-enable
  shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
  return 'denied';
}
```

**For Sequoia monthly re-prompt (PLAT-05):** Call `getMediaAccessStatus('screen')` on every app launch — do not assume a one-time grant persists. If status reverts to `'not-determined'` after a Sequoia re-prompt cycle, the gate above handles it correctly by showing the dialog again. Display a brief informational note to the user that this is expected macOS behavior.

### Pattern 4: Linux GPU Flags for Transparency (PLAT-02, PLAT-06)

Apply before `app.whenReady()`:

```typescript
// src/main/index.ts
if (process.platform === 'linux') {
  // Required for transparent BrowserWindow on X11 with NVIDIA drivers
  app.commandLine.appendSwitch('enable-transparent-visuals');
  app.commandLine.appendSwitch('disable-gpu');
}
```

**For Wayland (PLAT-06):** Wrap `desktopCapturer.getSources()` in try/catch and add an uncaught exception handler to prevent Electron from crashing when the XDP portal is dismissed:

```typescript
process.on('uncaughtException', (err) => {
  console.error('[snapview] Uncaught exception (possibly Wayland portal dismissal):', err.message);
  app.quit();
});
```

X11 is the primary target. Wayland support is a best-effort fallback — document this for users.

### Pattern 5: IPC Preload Bridge (contextBridge)

```typescript
// src/preload/preload.ts
import { contextBridge, ipcRenderer } from 'electron';
import type { RegionRect } from '../shared/types';

contextBridge.exposeInMainWorld('snapviewBridge', {
  getSources: (): Promise<{ id: string; thumbnail: string }[]> =>
    ipcRenderer.invoke('capture:get-sources'),
  captureRegion: (rect: RegionRect): Promise<{ filePath: string }> =>
    ipcRenderer.invoke('capture:region', rect),
  cancel: (): Promise<void> =>
    ipcRenderer.invoke('capture:cancel'),
});
```

**Rule:** The renderer never imports from `electron` directly. All privileged operations go through this bridge. The exposed surface is the minimum needed — nothing more.

### Pattern 6: Hard-Exit Timeout (PLAT-03)

Every Electron app instance must have this backstop in place before any UI is shown:

```typescript
// src/main/index.ts
const HARD_EXIT_TIMEOUT_MS = 30_000;
const hardExitTimer = setTimeout(() => {
  console.error('[snapview] Hard exit timeout reached — forcing quit');
  app.exit(1);
}, HARD_EXIT_TIMEOUT_MS);
hardExitTimer.unref(); // Don't let this timer keep the process alive
```

Clear the timer when the capture completes normally or the user cancels cleanly.

### Pattern 7: Capture Flow (main process)

```typescript
// src/main/capture.ts
import { desktopCapturer, nativeImage, screen } from 'electron';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import type { RegionRect, CaptureResult } from '../shared/types';

async function captureRegion(rect: RegionRect): Promise<CaptureResult> {
  // Use 'screen' type, not 'window' — avoids black screen on Chromium-based app windows
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: screen.getPrimaryDisplay().size.width,
      height: screen.getPrimaryDisplay().size.height,
    },
  });

  if (sources.length === 0) throw new Error('No screen sources found');

  // sources[0] is the primary display — use cursor display for multi-monitor
  const source = sources[0];
  const fullImage = source.thumbnail;

  // Scale rect from CSS pixels to physical pixels using the display scale factor
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const scaleFactor = display.scaleFactor;
  const physicalRect = {
    x: Math.round(rect.x * scaleFactor),
    y: Math.round(rect.y * scaleFactor),
    width: Math.round(rect.width * scaleFactor),
    height: Math.round(rect.height * scaleFactor),
  };

  const cropped = fullImage.crop(physicalRect);
  const pngBuffer = cropped.toPNG();

  // Write to os.tmpdir()/snapview/ with a unique filename
  const tempDir = path.join(os.tmpdir(), 'snapview');
  await fs.mkdir(tempDir, { recursive: true });
  const filename = `snapview-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.png`;
  const filePath = path.join(tempDir, filename);
  await fs.writeFile(filePath, pngBuffer);

  return { filePath };
}
```

### Pattern 8: Overlay Canvas (renderer)

The renderer draws a dimmed overlay over the full screen frame, tracks the user's drag to highlight the selection as a "cutout" at full brightness, then transitions to a preview panel on mouse-up.

Key canvas operations:
1. Draw the full-screen thumbnail (received from main via IPC) as the canvas background
2. Draw a semi-transparent dark rectangle over the entire canvas (`rgba(0, 0, 0, 0.45)` for 45% dim — within the locked 40-50% range)
3. Track `mousedown` / `mousemove` / `mouseup` to determine the selection rectangle
4. In the `mousemove` handler: clear the full overlay, redraw steps 1-2, then use `ctx.clearRect(selectionRect)` to "cut out" the selected area at full brightness, then draw a 1-2px border around the selection (e.g., `rgba(255, 255, 255, 0.8)`)
5. On `mouseup`: send the selection rect to main via `window.snapviewBridge.captureRegion(rect)`, display the cropped preview in a modal panel with Approve and Retake buttons

### Anti-Patterns to Avoid

- **`desktopCapturer` from renderer:** Moved to main-process-only in Electron 17+. Always call from main via `ipcMain.handle`.
- **`capturePage()` for screenshots:** Only captures the Electron window's own rendered content — returns blank for transparent windows.
- **`nodeIntegration: true`:** Never. Security liability. Use `contextBridge`.
- **`fullscreen: true` for single-monitor overlay:** Uses primary display regardless of cursor location. Use explicit `x/y/width/height` bounds instead.
- **`__dirname` for asset paths after global install:** Use `app.getAppPath()` inside Electron context. `__dirname` maps to ASAR bundle location, not the filesystem install path.
- **`window` source type in `desktopCapturer`:** Produces black screenshots for Chromium-based windows (VS Code, browsers). Use `screen` source type.
- **`execFileSync` to spawn Electron from CLI:** Blocks the shell; use `spawn` with piped stdout.
- **Writing screenshots to CWD:** Pollutes project directory; git picks them up. Always use `os.tmpdir()/snapview/`.
- **`getSources()` with oversized `thumbnailSize`:** Setting 4K thumbnail on a 1080p display adds 500ms+ latency. Match thumbnail size to the display's actual pixel dimensions.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Screen frame capture | Custom OS subprocess (scrot, screencapture) | `desktopCapturer.getSources({ types: ['screen'] })` | No OS dependencies; cross-platform; built-in permission handling |
| Image crop to PNG | Manual pixel manipulation | `nativeImage.crop(rect).toPNG()` | Buffer-ready output; handles color profiles correctly; no deps |
| Display geometry and DPI | Parse OS output | `screen.getDisplayNearestPoint()` + `.scaleFactor` | Handles HiDPI, multi-monitor, per-display scaling correctly |
| Cross-platform temp path | Hardcoded paths per platform | `os.tmpdir()` | Returns correct platform temp dir on all three platforms |
| macOS permission dialog | Custom dialog | `systemPreferences.askForMediaAccess('screen')` | Triggers the native OS permission sheet; required for App Store compliance |
| IPC message bus | EventEmitter or WebSocket between processes | `ipcMain.handle` + `ipcRenderer.invoke` | Built-in, typed, async request/response; secure by default |
| Asset path resolution | `__dirname`-relative paths | `app.getAppPath()` | Stable across dev, ASAR-packaged, and global npm install contexts |

**Key insight:** Electron provides built-ins for every Phase 1 problem. Reaching for external libraries for capture, image processing, or IPC is always wrong in this context.

---

## Common Pitfalls

### Pitfall 1: macOS `getSources()` Silent Hang (PLAT-01, PLAT-05)

**What goes wrong:** `desktopCapturer.getSources()` hangs indefinitely (never rejects) when screen recording permission is not granted. The app appears frozen with no feedback.

**Why it happens:** Chromium's permission gate halts the promise without notifying the renderer. Also, macOS Sequoia (15.x) re-prompts monthly — apps that assume a one-time grant silently stop working.

**How to avoid:** Always call `systemPreferences.getMediaAccessStatus('screen')` before `getSources()`. Gate the entire capture flow on this check. Re-run the check on every launch (not just first run).

**Warning signs:** App hangs on first macOS launch. Users on Sequoia report "stopped working" after a month. No error logged — just silence.

### Pitfall 2: Linux Transparent Overlay Renders as Opaque (PLAT-02)

**What goes wrong:** On X11 with NVIDIA drivers, `transparent: true` renders as a solid gray/black rectangle. Region selection is impossible.

**Why it happens:** Linux alpha-channel compositing requires explicit GPU flags not enabled by default. Chromium upstream bug.

**How to avoid:** Apply `--enable-transparent-visuals` and `--disable-gpu` via `app.commandLine.appendSwitch()` on Linux before `app.whenReady()`.

**Warning signs:** Overlay is solid color on any Linux machine. Works in dev (where transparency may accidentally work), fails on user machines.

### Pitfall 3: Path Resolution Breaks After Global Install (INST-02, INST-03)

**What goes wrong:** `__dirname` in the Electron ASAR context does not match the filesystem path of a globally-installed npm package. Silent ENOENT errors — "nothing happens" when the CLI is run.

**Why it happens:** Electron has three path contexts: development, packaged ASAR, and globally installed. Developers only test in dev mode.

**How to avoid:** Use `app.getAppPath()` inside Electron for all asset paths. Verify with `npm pack && npm install -g ./snapview-*.tgz` — do not accept "works with `node .`" as validation.

**Warning signs:** Hook installer fails with ENOENT after global install. Asset paths use `path.join(__dirname, '..', '..', ...)`.

### Pitfall 4: Black Screen When Capturing Electron/Chromium Windows

**What goes wrong:** `desktopCapturer` returns a black thumbnail when the target window is VS Code, a browser, or another Electron app. GPU compositing is not shared across process boundaries.

**Why it happens:** Documented upstream Chromium limitation (electron/electron#21687).

**How to avoid:** Use `types: ['screen']` in `getSources()`, not `types: ['window']`. Screen-source capture bypasses this limitation — the full display is captured regardless of what apps are in the selection region.

**Warning signs:** Black rectangles in preview when trying to capture VS Code or any browser window.

### Pitfall 5: `fullscreen: true` Targets Wrong Monitor (PLAT-04)

**What goes wrong:** `fullscreen: true` in `BrowserWindow` opens on the primary display, not the display where the cursor is.

**Why it happens:** `fullscreen` ignores the `x`/`y` position parameters — it always uses the primary display.

**How to avoid:** Use `screen.getDisplayNearestPoint(screen.getCursorScreenPoint())` to get the active display bounds, then set `x`, `y`, `width`, `height` explicitly with `fullscreen: false`.

**Warning signs:** On multi-monitor setups, the overlay always appears on monitor 1 regardless of where the cursor is.

### Pitfall 6: CSS Pixel Coordinates vs Physical Pixels (HiDPI)

**What goes wrong:** The selection rectangle drawn in the canvas (CSS pixels) does not match the physical pixels in the screenshot. The crop is off — covering a different region than what was selected visually.

**Why it happens:** On HiDPI displays (Retina, 4K), `display.scaleFactor` is 2 or higher. The renderer operates in CSS pixels; the `nativeImage` operates in physical pixels. Not applying the scale factor produces crops at the wrong location and wrong size.

**How to avoid:** Always multiply rect coordinates and dimensions by `display.scaleFactor` before calling `nativeImage.crop()`. Get the scale factor from `screen.getDisplayNearestPoint(cursor).scaleFactor`.

**Warning signs:** Preview image shows a different area than what was dragged. Works on 1080p monitors but fails on Retina or 4K screens.

### Pitfall 7: No Exit Path on All Code Branches (PLAT-03)

**What goes wrong:** If the user closes the overlay via the OS window controls (not ESC), or if the renderer crashes, `app.quit()` is never called. The Electron process hangs indefinitely. In Phase 2, this will permanently hang the Claude Code hook.

**Why it happens:** Developers test only the happy path and ESC — they don't test OS-level window dismissal or renderer crashes.

**How to avoid:**
- Handle `window-all-closed` event: `app.on('window-all-closed', () => app.quit())`
- Add the 30-second hard timeout backstop (Pattern 6 above)
- Handle both `close` and `closed` events on the BrowserWindow

---

## Code Examples

### Shared Types

```typescript
// src/shared/types.ts
export interface RegionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CaptureResult {
  filePath: string;
}

export type AppPhase = 'selecting' | 'previewing' | 'approved' | 'cancelled';
```

### electron-vite Configuration

```typescript
// electron.vite.config.ts
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    // No externalizeDepsPlugin here — renderer bundles its own deps
  },
});
```

`externalizeDepsPlugin()` marks Node.js built-ins and dependencies as external in the main/preload bundles — they are resolved at runtime from the `node_modules` that ship with the Electron app.

### Stdout Output Contract

The CLI should emit exactly one line to stdout on success, nothing on cancel, and an error message to stderr on failure. Stdout must be cleanly machine-parseable (per locked decision):

```
# Success: emit the absolute file path, nothing else
/tmp/snapview/snapview-1742000000000-a3f8b2c1.png

# Cancel: exit 2, no stdout output, optional stderr message
# Error: exit 1, no stdout output, error details to stderr
```

Recommended exit code convention (Claude's discretion to finalize):
- `0` — success, file path on stdout
- `1` — error (permission denied, capture failed, timeout)
- `2` — cancelled by user (ESC or window close without capturing)

This distinction matters for Phase 2 hook scripts to differentiate "user cancelled" from "tool broke."

### Startup Temp File Cleanup (FILE-01)

```typescript
// src/main/cleanup.ts
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export async function sweepOldCaptures(): Promise<void> {
  const snapviewDir = path.join(os.tmpdir(), 'snapview');
  try {
    const entries = await fs.readdir(snapviewDir);
    const now = Date.now();
    for (const entry of entries) {
      if (!entry.startsWith('snapview-') || !entry.endsWith('.png')) continue;
      const fullPath = path.join(snapviewDir, entry);
      const stat = await fs.stat(fullPath);
      if (now - stat.mtimeMs > TWENTY_FOUR_HOURS_MS) {
        await fs.unlink(fullPath).catch(() => {}); // Best-effort; ignore errors
      }
    }
  } catch {
    // snapview dir doesn't exist yet — fine
  }
}
```

Call `sweepOldCaptures()` early in `app.whenReady()` before creating the overlay window. Do not await it on the critical path — fire it as a background task.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `desktopCapturer` from renderer | `desktopCapturer` from main process only | Electron 17+ (2022) | Anti-pattern code fails with exception in modern Electron |
| `nodeIntegration: true` for IPC | `contextBridge.exposeInMainWorld` + `contextIsolation: true` | Electron 12+ (2021) | Security requirement; old pattern is a known attack vector |
| `new BrowserWindow({ webPreferences: { nodeIntegration: true } })` | `webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false }` | Current default | contextIsolation is now the default; explicitly set for clarity |
| `screen.getPrimaryDisplay()` for overlay | `screen.getDisplayNearestPoint(cursor)` | Always correct but widely ignored | Required for PLAT-04 multi-monitor support |
| `execFileSync` to spawn Electron | `spawn` with piped stdout | — | execFileSync blocks the shell; spawn is non-blocking |

**Deprecated/outdated:**
- `electron-screenshots` npm package: Last meaningful release 2021; targets old Electron APIs. Do not use.
- `screenshot-desktop` npm package: Shells out to OS-specific tools (scrot, screencapture). Breaks INST-02.
- Webpack for Electron builds: Significantly slower than Vite. electron-vite (Vite-based) is the current standard.

---

## Open Questions

1. **Electron 35.x vs newer for Linux regression**
   - What we know: The prior research flagged `screen.getCursorScreenPoint()` regressions across v29-v38. Electron 41.x was released 2026-03-13 (3 days ago).
   - What's unclear: Whether v39, v40, or v41 resolved the Linux cursor regression.
   - Recommendation: Pin to 35.7.5 for Phase 1 to avoid risk. Check the Electron 36+ changelogs for "getCursorScreenPoint Linux" fixes before upgrading.

2. **`sandbox: false` vs `sandbox: true` in webPreferences**
   - What we know: electron-vite scaffolded apps use `sandbox: false` to enable preload IPC. `sandbox: true` blocks `ipcRenderer` in the preload.
   - What's unclear: Whether `sandbox: true` with contextBridge is achievable in Phase 1's use case (renderer needs to invoke IPC).
   - Recommendation: Use `sandbox: false` for Phase 1 (standard electron-vite pattern). Revisit in a later phase if security hardening is needed.

3. **Canvas-based preview vs separate preview BrowserWindow**
   - What we know: Preview can either be shown in the same overlay canvas (overlay dims, preview panel appears) or in a separate small BrowserWindow.
   - What's unclear: The user left this to Claude's discretion — but the choice affects how the overlay/preview state machine is built.
   - Recommendation: Keep the preview in the same BrowserWindow (canvas transitions to a centered preview panel). Avoids two-window IPC complexity. Preview panel overlays the dimmed canvas with a solid background.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | bun:test (built into Bun — no additional install) |
| Config file | None required — `bun test` discovers `*.test.ts` files |
| Quick run command | `bun test` |
| Full suite command | `bun test --coverage` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAPT-05 | PNG written to os.tmpdir()/snapview/ with unique filename | unit | `bun test src/main/capture.test.ts` | ❌ Wave 0 |
| FILE-01 | Filename format: `snapview-{timestamp}-{hex}.png` | unit | `bun test src/main/capture.test.ts` | ❌ Wave 0 |
| PLAT-01 | macOS permission gate returns 'denied' when status is 'denied' | unit | `bun test src/main/capture.test.ts` | ❌ Wave 0 |
| PLAT-03 | Hard exit timer is set; clears on clean exit | unit | `bun test src/main/index.test.ts` | ❌ Wave 0 |
| CAPT-01 | BrowserWindow created with transparent/frame:false/alwaysOnTop | integration (manual) | Manual — requires display | ❌ Manual only |
| CAPT-02 | Canvas renders dimmed overlay with selection cutout | integration (manual) | Manual — requires display | ❌ Manual only |
| CAPT-03 | Preview panel shows approve/retake after selection | integration (manual) | Manual — requires display | ❌ Manual only |
| CAPT-04 | ESC closes overlay cleanly, exit code 2 | integration (manual) | Manual — requires display | ❌ Manual only |
| PLAT-02 | Linux GPU flags applied on process.platform === 'linux' | unit (mock platform) | `bun test src/main/index.test.ts` | ❌ Wave 0 |
| PLAT-04 | Overlay bounds match the display nearest cursor | unit (mock screen) | `bun test src/main/index.test.ts` | ❌ Wave 0 |
| PLAT-06 | Wayland uncaughtException handler calls app.quit() | unit | `bun test src/main/index.test.ts` | ❌ Wave 0 |
| INST-02 | CLI entry point spawns Electron binary from electron package | unit | `bun test bin/snapview.test.cjs` | ❌ Wave 0 |
| INST-03 | Temp dir path uses os.tmpdir() not hardcoded path | unit | `bun test src/main/capture.test.ts` | ❌ Wave 0 |
| PLAT-05 | getMediaAccessStatus called on every launch (not cached) | unit | `bun test src/main/capture.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `bun test` (unit tests only — runs in < 10 seconds)
- **Per wave merge:** `bun test --coverage`
- **Phase gate:** All unit tests green + manual platform checklist completed before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/main/capture.test.ts` — unit tests for PNG write, filename format, macOS permission gate, temp path
- [ ] `src/main/index.test.ts` — unit tests for Linux GPU flags, hard exit timer, display bounds selection, Wayland handler
- [ ] `bin/snapview.test.cjs` — unit test for CLI entry point spawn logic
- [ ] `src/main/cleanup.test.ts` — unit tests for sweepOldCaptures (file age filtering, error handling)

**Note:** UI/overlay tests (CAPT-01 through CAPT-04) require a display and must be validated manually on each target platform. Automate the platform detection logic; accept manual validation for render output.

---

## Sources

### Primary (HIGH confidence)

- [Electron desktopCapturer API](https://www.electronjs.org/docs/latest/api/desktop-capturer) — `getSources()` schema, `types: ['screen']` requirement, platform limitations
- [Electron BrowserWindow API](https://www.electronjs.org/docs/latest/api/browser-window) — `transparent`, `frame`, `alwaysOnTop`, `x/y/width/height` parameters
- [Electron screen API](https://www.electronjs.org/docs/latest/api/screen) — `getCursorScreenPoint()`, `getDisplayNearestPoint()`, `scaleFactor`
- [Electron systemPreferences API](https://www.electronjs.org/docs/latest/api/system-preferences) — `getMediaAccessStatus('screen')`, `askForMediaAccess('screen')`
- [Electron IPC docs](https://www.electronjs.org/docs/latest/tutorial/ipc) — `ipcMain.handle` / `ipcRenderer.invoke` async pattern
- [Electron contextBridge docs](https://www.electronjs.org/docs/latest/api/context-bridge) — `exposeInMainWorld`, contextIsolation requirement
- [electron-vite Getting Started](https://electron-vite.org/guide/) — project structure, `externalizeDepsPlugin`, build output paths
- npm registry — Verified current versions: electron@41.0.2 (latest), 35.7.5 (pinned), electron-vite@5.0.0, electron-builder@26.8.1, typescript@5.9.3, commander@14.0.3

### Secondary (MEDIUM confidence)

- [electron/electron#21687](https://github.com/electron/electron/issues/21687) — Black screen on Chromium window capture (confirms `screen` type recommendation)
- [electron/electron#45198](https://github.com/electron/electron/issues/45198) — Linux XDP portal crash on Wayland (confirms Wayland risk)
- [electron/electron#40515](https://github.com/electron/electron/issues/40515) — Transparent window black background on Linux (confirms GPU flag requirement)
- [macOS Sequoia screen recording monthly prompt — 9to5Mac](https://9to5mac.com/2024/10/07/macos-sequoia-screen-recording-popups/) — Confirms Sequoia re-prompt behavior
- `.planning/research/PITFALLS.md` — Project-specific pitfall research (HIGH — already synthesized from official sources)
- `.planning/research/STACK.md` — Project-specific stack research (HIGH — already synthesized from official sources)
- `.planning/research/ARCHITECTURE.md` — Project-specific architecture research (HIGH — already synthesized from official sources)

### Tertiary (LOW confidence)

- Prior research note on `screen.getCursorScreenPoint()` Linux regression in v29-v38 — unverified against Electron changelogs for v39+; treat as caution, not confirmed fact.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — All versions verified against npm registry 2026-03-16; core APIs verified against Electron official docs
- Architecture: HIGH — Patterns derived from official Electron IPC, contextBridge, screen, and desktopCapturer docs; cross-referenced against prior project research
- Pitfalls: HIGH — Each pitfall backed by a specific Electron GitHub issue or official documentation reference
- Validation: HIGH — bun:test is the project's test runner (per global CLAUDE.md conventions); test mapping is complete

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (Electron releases frequently; recheck version pin before implementation if > 2 weeks pass)
