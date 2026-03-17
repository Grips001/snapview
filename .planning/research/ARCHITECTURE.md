# Architecture Research

**Domain:** Electron-based screenshot capture tool with Claude Code CLI integration
**Researched:** 2026-03-16
**Confidence:** HIGH (Electron official docs + Claude Code official docs verified)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLAUDE CODE SESSION                           │
│                                                                      │
│  ┌──────────────────┐    ┌─────────────────────────────────────┐    │
│  │  /snapview Skill  │    │  Hooks (.claude/settings.json)      │    │
│  │  (SKILL.md)       │    │  PostToolUse matcher: Bash           │    │
│  │  triggers manual  │    │  (auto-trigger when Claude requests) │    │
│  └────────┬──────────┘    └──────────────┬──────────────────────┘    │
│           │                              │                            │
│           │ Bash: snapview capture       │ stdin: JSON event context  │
│           └──────────────┬───────────────┘                            │
│                          │                                            │
└──────────────────────────┼────────────────────────────────────────────┘
                           │ spawn process
                           ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     CLI ENTRY POINT (Node.js)                        │
│                     bin/snapview.cjs                                 │
│                                                                      │
│  Parse args → spawn Electron process with app path + IPC args       │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ child_process.spawn(electronBinary, [...])
                           ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     ELECTRON MAIN PROCESS                            │
│                     src/main/index.ts                                │
│                                                                      │
│  ┌──────────────────┐    ┌──────────────────┐    ┌───────────────┐  │
│  │  Window Manager   │    │  Capture Service  │    │  IPC Router   │  │
│  │  Creates overlay  │    │  desktopCapturer  │    │  ipcMain      │  │
│  │  BrowserWindow    │    │  getSources()     │    │  handlers     │  │
│  └────────┬──────────┘    └──────────┬────────┘    └──────┬────────┘  │
│           │                          │                    │            │
│           └──────────────────────────┴────────────────────┘            │
│                                      │                                 │
│                    Preload Script (contextBridge)                      │
└──────────────────────────────────────┼─────────────────────────────────┘
                                       │ ipcRenderer (safe bridge)
                                       ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     ELECTRON RENDERER PROCESS                        │
│                     src/renderer/index.html + app.ts                 │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Overlay UI (transparent fullscreen BrowserWindow)            │   │
│  │                                                               │   │
│  │  ┌─────────────────┐    ┌────────────────┐                   │   │
│  │  │  Region Selector │    │  Preview Panel  │                   │   │
│  │  │  Canvas drag     │    │  Approve/Retake │                   │   │
│  │  │  to select area  │    │  flow           │                   │   │
│  │  └────────┬─────────┘    └───────┬─────────┘                   │   │
│  │           │                      │                              │   │
│  └───────────┼──────────────────────┼──────────────────────────────┘   │
│              │ ipcRenderer.invoke   │ ipcRenderer.invoke               │
│              │ 'capture:region'     │ 'capture:approve'                │
└──────────────┼──────────────────────┼──────────────────────────────────┘
               │                      │ returns temp file path
               ↓                      ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     FILE OUTPUT LAYER                                │
│                                                                      │
│  OS Temp Dir (os.tmpdir()/snapview/)                                 │
│  └── snapview-{timestamp}-{random}.png                              │
│      (24-hour cleanup via startup sweep)                             │
└──────────────────────────────────────┬──────────────────────────────┘
                                       │ stdout: file path
                                       ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     CLAUDE CODE — READ TOOL                          │
│                                                                      │
│  Claude reads the temp file path from stdout → uses Read tool        │
│  to inject image into conversation context                           │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| CLI Entry Point | Parse invocation args, locate Electron binary, spawn app | Node.js bin script, `child_process.spawn`, packaged with `electron` as dep |
| Installer (`snapview install`) | Write SKILL.md to `~/.claude/skills/snapview/` and hooks to `~/.claude/settings.json` | Node.js script, JSON merge for settings, file write for skill |
| Electron Main Process | Create BrowserWindow, handle IPC, invoke `desktopCapturer`, write temp file | `electron` main.ts, `ipcMain.handle`, `desktopCapturer.getSources()` |
| Preload Script | Bridge main ↔ renderer safely via `contextBridge` | `contextBridge.exposeInMainWorld`, exposes only needed channels |
| Overlay Renderer | Full-screen transparent UI for region drag-select and preview | HTML Canvas for rubber-band selection, `getUserMedia` or canvas crop for preview |
| Capture Service | Get screen sources, crop selected region, encode to PNG | `desktopCapturer`, Canvas 2D API for crop, `toDataURL` or `nativeImage` |
| File Output | Write PNG to OS temp dir, track files for cleanup | `os.tmpdir()`, `fs.writeFile`, sweep on startup (delete >24hr files) |
| `/snapview` Skill | Expose manual trigger in Claude Code session | `~/.claude/skills/snapview/SKILL.md` with `disable-model-invocation: true` (user controls timing) |
| Hooks Config | Auto-trigger capture when Claude requests it | `~/.claude/settings.json` `PostToolUse` or `Notification` hook targeting a `snapview-hook` command |

## Recommended Project Structure

```
snapview/
├── bin/
│   └── snapview.cjs          # CLI entry point (CommonJS, globally installed)
├── src/
│   ├── main/
│   │   ├── index.ts          # Electron main process — window creation, IPC handlers
│   │   ├── capture.ts        # desktopCapturer wrapper, PNG writing, temp file management
│   │   └── cleanup.ts        # 24-hour temp file sweep on startup
│   ├── renderer/
│   │   ├── index.html        # Overlay window shell
│   │   ├── app.ts            # Region selector + preview UI logic
│   │   └── styles.css        # Transparent overlay, canvas, preview styles
│   └── preload/
│       └── preload.ts        # contextBridge exposing capture and close channels
├── install/
│   ├── installer.ts          # `snapview install` — writes skill + hooks config
│   ├── skill-template.md     # Template for ~/.claude/skills/snapview/SKILL.md
│   └── hooks-config.ts       # JSON structure for ~/.claude/settings.json hooks entry
├── shared/
│   └── types.ts              # Shared types: CaptureResult, RegionRect, etc.
├── package.json              # "bin": { "snapview": "bin/snapview.cjs" }
└── electron-builder.yml      # (optional) packaging config
```

### Structure Rationale

- **bin/**: Single CJS entry point — globally installed, spawns Electron. Kept minimal; all logic in `src/`.
- **src/main/**: Main process has no renderer dependencies. Capture logic isolated in `capture.ts` for testability.
- **src/renderer/**: Self-contained UI. No Node access — communicates only through preload bridge.
- **src/preload/**: Strict surface area. Only exposes IPC channels needed by renderer — nothing more.
- **install/**: Separated from runtime. Install is a one-time setup concern; keeping it isolated prevents runtime bloat.
- **shared/types.ts**: Types safe to import in both main and renderer (no platform-specific imports).

## Architectural Patterns

### Pattern 1: CLI Spawns Electron (Not App Launch)

**What:** The npm global binary is a thin Node.js script. It locates the `electron` binary (bundled as a dependency) and calls `child_process.spawn(electronPath, [appDir], { stdio: 'inherit' })`. The Electron app writes the final temp file path to stdout and exits, which the CLI captures and prints for Claude Code to consume.

**When to use:** Always — this is the canonical pattern for globally-installable Electron CLI tools. The `electron` package itself exposes `require('electron')` which returns the binary path.

**Trade-offs:** Adds `~50-80MB` for the Electron binary. Accepted for the cross-platform guarantee. Startup latency is the main concern — minimize main process initialization work.

**Example:**
```javascript
// bin/snapview.cjs
const { execFileSync, spawn } = require('child_process');
const electronPath = require('electron'); // returns binary path
const path = require('path');

const appPath = path.join(__dirname, '..', 'src', 'main', 'index.js');
const proc = spawn(electronPath, [appPath, ...process.argv.slice(2)], {
  stdio: 'inherit'
});
proc.on('exit', (code) => process.exit(code ?? 0));
```

### Pattern 2: Transparent Fullscreen Overlay Window

**What:** The capture UI is a `BrowserWindow` with `transparent: true`, `frame: false`, `fullscreen: true`, and `alwaysOnTop: true`. The renderer uses an HTML Canvas to draw the dimmed overlay and rubber-band drag selection. `desktopCapturer.getSources({ types: ['screen'] })` is called from the main process (renderer cannot call it directly in modern Electron) and the thumbnail is passed to the renderer for preview cropping.

**When to use:** For region selection UIs — this is the standard Electron pattern. The overlay must be created before capture to show the selection UI.

**Trade-offs:** On Windows, `transparent` windows may have GPU compositing overhead. `alwaysOnTop` requires the window level to be set carefully to avoid covering system dialogs. Linux transparency requires a compositor.

**Example:**
```typescript
// src/main/index.ts
const overlay = new BrowserWindow({
  fullscreen: true,
  transparent: true,
  frame: false,
  alwaysOnTop: true,
  webPreferences: {
    preload: path.join(__dirname, '../preload/preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
  },
});
overlay.loadFile(path.join(__dirname, '../renderer/index.html'));
```

### Pattern 3: IPC with contextBridge (Security-Safe Bridge)

**What:** Renderer never has `nodeIntegration: true`. All privileged operations (file system, `desktopCapturer`) live in main process. Preload script uses `contextBridge.exposeInMainWorld` to expose a typed API surface. Renderer calls `window.snapviewBridge.captureRegion(rect)`.

**When to use:** Always in modern Electron — the default `contextIsolation: true` requires this pattern. Protects against renderer-side XSS affecting host filesystem.

**Trade-offs:** Slightly more boilerplate than `nodeIntegration: true`, but mandatory for security and App Store compliance. Worth it — overlay window loads local HTML, so risk is low, but the pattern is correct practice.

**Example:**
```typescript
// src/preload/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('snapviewBridge', {
  getSources: () => ipcRenderer.invoke('capture:get-sources'),
  captureRegion: (rect: RegionRect) => ipcRenderer.invoke('capture:region', rect),
  cancel: () => ipcRenderer.invoke('capture:cancel'),
});
```

### Pattern 4: Claude Code Skill + Hook Integration

**What:** Two separate integration points. (1) A skill at `~/.claude/skills/snapview/SKILL.md` with `disable-model-invocation: true` creates the `/snapview` slash command — user-controlled. (2) A hook in `~/.claude/settings.json` enables auto-trigger: a `PostToolUse` or `Notification` hook that runs a shell command invoking `snapview` when Claude outputs a specific signal phrase (e.g., "please share your screen" or a structured JSON request).

**When to use:** Both together. Skill handles manual trigger; hook handles auto-trigger. The hook is scoped to user's global settings (not project-committed) because it installs a global binary path.

**Trade-offs:** Auto-trigger via hook requires Claude to output a recognizable signal. Using a structured stdout pattern (JSON with `{ "action": "request_screenshot" }`) is more reliable than regex on natural language. The hook command receives JSON via stdin and can parse it.

**Example skill frontmatter:**
```yaml
---
name: snapview
description: Capture a screenshot and share it with Claude
disable-model-invocation: true
argument-hint: "[region|fullscreen]"
allowed-tools: Bash(snapview *)
---

Run `snapview capture` to open the screen capture overlay.
Select a region, approve the preview, and the image will be shared.
```

## Data Flow

### Manual Trigger Flow (User types `/snapview`)

```
User types /snapview
    ↓
Claude Code loads SKILL.md content
    ↓
Claude executes: Bash("snapview capture")
    ↓
bin/snapview.cjs spawns Electron process
    ↓
Electron main: creates transparent overlay BrowserWindow
    ↓
Electron main: calls desktopCapturer.getSources() → sends to renderer via IPC
    ↓
Renderer: shows overlay, user drags to select region
    ↓
Renderer: shows preview, user clicks Approve
    ↓
Renderer: sends {rect, sourceId} via ipcRenderer.invoke('capture:region', rect)
    ↓
Main: crops screenshot using Canvas/nativeImage, writes PNG to os.tmpdir()/snapview/
    ↓
Main: sends file path back to renderer (for display), prints path to stdout
    ↓
Electron app exits with code 0
    ↓
bin/snapview.cjs stdout contains: /tmp/snapview/snapview-1710000000000-abc123.png
    ↓
Claude receives stdout → uses Read tool on the path → image injected into context
```

### Auto-Trigger Flow (Claude requests screenshot)

```
Claude outputs structured signal (JSON or specific phrase)
    ↓
PostToolUse hook fires (matcher: "Bash" or broad matcher)
    ↓
Hook command: snapview-hook.sh receives event JSON via stdin
    ↓
Hook parses JSON, detects screenshot request signal
    ↓
Hook spawns: snapview capture --auto
    ↓
[same Electron capture flow as above]
    ↓
Hook outputs JSON: { "additionalContext": "Screenshot saved to: /tmp/snapview/..." }
    ↓
Claude receives context on next turn → uses Read tool on path
```

### State Management (In-Process, No Persistence)

```
App State (renderer-local, ephemeral):
  phase: 'selecting' | 'previewing' | 'done' | 'cancelled'
    ↓ (user drags)
  selectedRect: { x, y, width, height }
    ↓ (IPC response)
  previewDataUrl: string  (canvas crop for display)
    ↓ (user approves)
  [app exits — no state survives between invocations]
```

No state store needed. Each invocation is a single short-lived flow.

### Key Data Flows

1. **Screen source to renderer:** `desktopCapturer.getSources()` must run in main process → thumbnail (NativeImage) serialized as data URL → sent via IPC to renderer for canvas overlay.
2. **Region rect to PNG:** Renderer captures drag coordinates → sends to main via IPC → main uses `nativeImage` crop API → writes PNG bytes to temp file → returns path.
3. **Path to Claude:** Electron app writes file path to stdout → CLI captures it → Claude reads stdout as tool result → Claude calls Read tool on path.

## Scaling Considerations

This is a desktop tool — "scaling" means multi-monitor, multi-display, and concurrent session concerns, not web-scale.

| Concern | At Single Display | At Multi-Monitor | Notes |
|---------|------------------|-----------------|-------|
| Screen sources | One source → simple | Multiple sources from `desktopCapturer` → need source picker or target primary | `desktopCapturer` returns all connected displays |
| Concurrent invocations | Not expected, but possible | Use file locks or unique temp names | Already handled by timestamp+random in filename |
| Temp file accumulation | Startup sweep covers it | Same | Sweep deletes files older than 24hr at process start |
| Startup speed | Cold Electron launch ~500ms-1s | Same — overlay appears after BrowserWindow ready | Minimize main process initialization, defer non-critical work |

## Anti-Patterns

### Anti-Pattern 1: Calling desktopCapturer from Renderer

**What people do:** Enable `nodeIntegration: true` and call `desktopCapturer.getSources()` directly in renderer JavaScript.

**Why it's wrong:** `desktopCapturer` was moved to main-process-only in Electron 17+. Calling it from renderer throws. Even before that, `nodeIntegration: true` is a security liability.

**Do this instead:** Call `desktopCapturer.getSources()` in main process via `ipcMain.handle`, return serialized data to renderer via IPC.

### Anti-Pattern 2: Writing Screenshots to Project/CWD

**What people do:** Save screenshot PNGs to the current working directory or a project-relative path for "easy access."

**Why it's wrong:** Pollutes the user's project directory. Screenshots accumulate silently. Git picks them up. Claude Code's CWD is the project root — unexpected files appear in `git status`.

**Do this instead:** Always write to `os.tmpdir()` with a `snapview/` subdirectory. Clean up files older than 24 hours on startup.

### Anti-Pattern 3: Blocking CLI Until Electron Exits

**What people do:** Use `execFileSync` (synchronous) to spawn Electron, blocking the shell until the window closes.

**Why it's wrong:** Blocks the terminal, prevents Claude Code from receiving incremental output, and can cause timeout issues if the user takes time selecting a region.

**Do this instead:** Use `spawn` with `stdio: 'pipe'`, collect stdout, and resolve when process exits. The Electron app exits itself after capture or cancel.

### Anti-Pattern 4: Skill with `disable-model-invocation: false` for Side-Effect Commands

**What people do:** Leave default frontmatter so Claude can auto-invoke `/snapview` whenever it thinks a screenshot would help.

**Why it's wrong:** Opens a screenshot overlay unexpectedly at inopportune moments. The capture UI is disruptive — it takes over the screen.

**Do this instead:** Set `disable-model-invocation: true` in SKILL.md. Use a hook for auto-trigger, not model invocation. Auto-trigger via hook gives the user explicit control during `snapview install`.

### Anti-Pattern 5: MCP Server for Image Injection

**What people do:** Build a full MCP server that registers a `take_screenshot` tool Claude can call via the MCP protocol.

**Why it's wrong:** Adds protocol overhead, requires a running server process, complicates installation significantly, and the simpler alternative (file + Read tool) already works natively in Claude Code.

**Do this instead:** Write PNG to temp file, output path to stdout, let Claude use the native Read tool. Zero protocol overhead, proven mechanism.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Claude Code (skill) | SKILL.md file at `~/.claude/skills/snapview/` | Installer writes this; slash command `/snapview` appears immediately |
| Claude Code (hooks) | JSON merge into `~/.claude/settings.json` hooks key | Installer must read existing settings and merge, not overwrite |
| OS screen capture | Electron `desktopCapturer` API | No OS permissions dialog needed on Windows; macOS requires Screen Recording permission (Electron handles the prompt) |
| OS temp dir | `os.tmpdir()` → `snapview/` subdirectory | Cross-platform: `C:\Users\...\AppData\Local\Temp\snapview` on Windows, `/tmp/snapview` on Linux/macOS |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| CLI bin ↔ Electron app | `child_process.spawn` + stdout pipe | App writes file path to stdout on success; exit code 0 = success, 1 = error, 2 = cancelled |
| Electron main ↔ renderer | IPC via `ipcMain.handle` / `ipcRenderer.invoke` | Always async invoke/handle pattern (not send/on) for request-response flows |
| Renderer ↔ preload | `contextBridge` surface only | Renderer never imports from `electron` directly |
| Installer ↔ Claude settings | File system read/write of `~/.claude/settings.json` | Must handle non-existent file, malformed JSON, and existing hooks entries gracefully |
| Hook script ↔ Claude | stdin JSON + stdout JSON response | Hook receives event context; responds with `additionalContext` field for Claude to consume |

## Sources

- [Electron Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model) — official docs, main/renderer architecture
- [Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc) — official docs, ipcMain/ipcRenderer patterns
- [Electron desktopCapturer](https://www.electronjs.org/docs/latest/api/desktop-capturer) — official API reference
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) — official docs, hook events, JSON schema, handler types (HIGH confidence)
- [Claude Code Skills Reference](https://code.claude.com/docs/en/skills) — official docs, SKILL.md frontmatter, invocation control (HIGH confidence)
- [How to build an Electron desktopCapturer screen picker dialog](https://john-tacker.medium.com/how-to-build-an-electron-desktopcapturer-screen-picker-dialog-933d004ee8e) — pattern reference for picker UI
- [Claude Code Transparent Windows](https://www.electronjs.org/docs/latest/tutorial/custom-window-styles) — official docs, frameless/transparent BrowserWindow

---
*Architecture research for: Electron screenshot capture tool with Claude Code integration*
*Researched: 2026-03-16*
