# Stack Research

**Domain:** Cross-platform screenshot capture CLI tool (Electron + npm global distribution + Claude Code integration)
**Researched:** 2026-03-16
**Confidence:** HIGH (core stack), MEDIUM (distribution pattern), HIGH (Claude Code hooks)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Electron | 35.x (stable) | Cross-platform desktop app shell for the capture UI | Ships its own Chromium+Node — eliminates OS-specific screenshot tool dependencies. v35 is current LTS-equivalent (v36+ in beta as of March 2026). Don't use v39 yet: it bundles Node 22.20.0 and Chromium 142 but was released Nov 2025 — prefer the most recent non-beta major. |
| TypeScript | 5.x (latest) | Type safety across main process, renderer, preload | Electron's own types are in DefinitelyTyped; TS catches IPC contract mismatches at compile time, which are the #1 source of Electron bugs. |
| electron-vite | 5.x | Build tooling (Vite-based bundler for Electron's split environment) | Understands Electron's main/renderer/preload split natively. Provides hot-reloading for renderer and main process during development. Recommended over raw Vite+plugins or webpack. |
| electron-builder | 26.x (latest: 26.8.1) | Package for production, build cross-platform distributable | More widely adopted than Electron Forge (1.2M vs 2k weekly downloads). Handles code signing, NSIS installers, and the `asar` packing needed for npm-distributed binaries. Use it only for the Electron binary — the npm global wrapper is separate. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `electron` (npm package) | 35.x | Spawns the Electron binary in the CLI wrapper | The npm global package's `bin` entry is a Node.js script that calls `require('electron')` to launch the bundled Electron app. This is the standard pattern for distributing Electron via npm. |
| `nativeImage` (Electron built-in) | built-in | Crop the captured region and encode to PNG | No external image library needed. `nativeImage.crop(rect)` + `.toPNG()` returns a Buffer ready to write. Adding `sharp` or `jimp` is unnecessary overhead for v1. |
| `desktopCapturer` (Electron built-in) | built-in | Enumerate available screens, capture full-screen frames | The only correct way to capture other app windows cross-platform in Electron. Do NOT use `capturePage()` — it only captures Electron's own window contents. |
| `screen` (Electron built-in) | built-in | Get display geometry, DPI scale factors, cursor position | Required to correctly map the user's drawn selection rectangle to physical pixel coordinates across multi-monitor + HiDPI setups. |
| `fs/promises` (Node built-in) | Node 22 | Write PNG buffer to OS temp directory | `os.tmpdir()` gives the platform temp path. No extra library needed. |
| `commander` | 12.x | CLI argument parsing in the npm global wrapper | Parses `--output`, `--format`, `--region` flags if needed in later phases. Lightweight. `yargs` is heavier and overkill here. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `electron-vite` CLI | `dev` / `build` / `preview` commands for the Electron app | Run `electron-vite dev` for hot-reload development; `electron-vite build` produces the bundled app. |
| `electron-builder` CLI | Produces platform-specific binaries (`.app`, `.exe`, `.AppImage`) during CI | Only needed for creating the bundled Electron binary that ships inside the npm package. Not needed during development. |
| `bun` | Package manager, test runner | Project uses bun per global conventions. `bun run build`, `bun test`. |
| TypeScript compiler (`tsc`) | Type checking only (no emit — electron-vite handles emit) | Run `tsc --noEmit` as a pre-commit type check. |

## Installation

```bash
# Core application
bun add electron electron-vite typescript

# CLI argument parsing
bun add commander

# Build/distribution (dev only)
bun add -D electron-builder @electron/notarize

# TypeScript types
bun add -D @types/node
# electron types are bundled with the electron package itself
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Electron | Tauri (Rust + WebView) | When binary size matters more than startup simplicity. Tauri produces ~5MB binaries vs Electron's 50-80MB, but requires Rust toolchain and has no `desktopCapturer` equivalent — you'd need a Rust native module for screen capture, adding significant complexity. Not worth it for v1. |
| Electron | nw.js | Never. nw.js is effectively unmaintained vs Electron's active development cadence. |
| Electron | Native OS tools (scrot, screencapture, Snipping Tool) | If you were willing to drop cross-platform support entirely. These don't work without OS-specific tooling present, breaking the "no OS dependencies" constraint. |
| electron-vite | Electron Forge + Vite plugin | Electron Forge is Electron's "official" scaffolding tool but has 2k vs electron-vite's much larger real-world usage. electron-vite's config is simpler for this use case (no plugin composability needed). |
| electron-builder | Electron Forge (make) | If you want the Electron-blessed toolchain. Forge is fine but has fewer escape hatches for unusual distribution targets like "embed the binary inside an npm global package." |
| `nativeImage` (built-in) | `sharp` | Use `sharp` only if you need to resize/compress screenshots before sending to Claude. For v1 the raw PNG is fine; Claude handles large images without issue. |
| `commander` | `yargs`, `meow`, `minimist` | `yargs` if the CLI grows complex (subcommands, interactive prompts). `meow` if TypeScript types are a priority. `commander` is the sweet spot for a focused single-purpose CLI. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `screenshot-desktop` npm package | Shells out to platform-specific tools (`screencapture` on macOS, `scrot` on Linux) — breaks the "no OS dependencies" constraint exactly as stated in PROJECT.md | `desktopCapturer` (Electron built-in) |
| `capturePage()` on a transparent overlay window | `capturePage()` captures only the Electron window's own rendered content, returning a blank image when the window is transparent | `desktopCapturer.getSources()` with `screen` type, then draw to canvas in renderer |
| `electron-screenshots` (npm package) | Last meaningful release was 2021, unmaintained, targets older Electron APIs | Custom implementation using `desktopCapturer` + canvas overlay |
| `nexe` / `pkg` | Compile Node.js to a single binary — wrong tool for Electron apps. The Electron runtime cannot be packed into a Node binary. | `electron-builder` for the Electron binary; npm `bin` field script that `require('electron')` for the global CLI entry point |
| Webpack | Significantly slower than Vite for development iteration. `electron-vite` (Vite-based) gives sub-second HMR for renderer changes | `electron-vite` |
| `electron@latest` (v39.x) | v39 was released Nov 2025 and is very new. The bugs around `screen.getCursorScreenPoint()` regressions on Linux are not fully resolved as of early 2026. Prefer the most recently battle-tested stable branch. | Pin to `35.x` initially, upgrade after validating on all platforms |
| jQuery / heavy UI frameworks | React/Vue/Angular add unnecessary weight to an overlay UI that is a single fullscreen canvas element with a preview modal | Vanilla TS in the renderer with minimal DOM manipulation |

## Stack Patterns by Variant

**npm global distribution pattern:**
- The npm package's `package.json` `bin` entry points to a thin Node.js script (e.g., `bin/snapview.js`)
- That script calls `require('electron')` which returns the path to the Electron binary, then `spawn(electronPath, [path.join(__dirname, '../app/main.js')])` to launch the app
- The bundled Electron app lives at `app/` inside the npm package
- `electron-builder` produces the platform binary that gets embedded; `electron-vite build` produces the JS bundle
- This is how VS Code's `code` CLI wrapper works conceptually

**Claude Code hooks integration pattern:**
- A `UserPromptSubmit` hook in `~/.claude/settings.json` watches for `/snapview` in the prompt text, launches the Electron app, and injects the resulting file path into Claude's context via stdout
- A `PostToolUse` hook matching `Read` can detect when Claude reads a snapshot file and trigger cleanup
- Hooks communicate with the Electron process via exit codes and stdout — the hook script is a thin shell wrapper around the Electron binary call
- The hook writes the image path to stdout (which Claude Code adds to context as `additionalContext`) so Claude knows to read the file

**macOS permissions pattern:**
- Must include `NSScreenCaptureDescription` in `Info.plist` entitlements
- Call `systemPreferences.getMediaAccessStatus('screen')` before `desktopCapturer.getSources()` and prompt the user if not granted
- On macOS 14.2+, the app bundle ID must be set explicitly (not default "Electron") or permission caching fails — set `appId` in `electron-builder` config

**Region selection UI pattern:**
- Create a `BrowserWindow` with `{ transparent: true, frame: false, fullscreen: true, alwaysOnTop: true }`
- Use a fullscreen `<canvas>` element in the renderer
- Capture the full screen via `desktopCapturer` and draw it as the canvas background (gives the "dimmed overlay" effect)
- Listen to `mousedown`/`mousemove`/`mouseup` to draw the selection rectangle
- On mouseup, calculate the selection rect in CSS pixels, convert to physical pixels using `screen.getPrimaryDisplay().scaleFactor`, then crop with `nativeImage.crop()`

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `electron@35.x` | Node 22.x (bundled), Chromium 130.x (bundled) | All Node APIs available to main process. Renderer runs in a locked Chromium — don't rely on bleeding-edge Web APIs. |
| `electron-vite@5.x` | `electron@28+`, `vite@5+` | electron-vite v5 requires Vite 5. Pin `vite` to v5.x in devDependencies. |
| `electron-builder@26.x` | `electron@20+` | Works with Electron 35. Requires Node 18+ on the build machine. |
| `commander@12.x` | Node 18+ | No issues with the bun runtime. |
| `typescript@5.x` | All above | Use `moduleResolution: "bundler"` in `tsconfig.json` for renderer/preload; `"nodenext"` for the CLI wrapper (pure Node.js). |

## Sources

- [Electron desktopCapturer official docs](https://www.electronjs.org/docs/latest/api/desktop-capturer) — API schema, platform limitations, permission requirements (HIGH confidence)
- [Electron 39 release blog](https://www.electronjs.org/blog/electron-39-0) — Current version, Node 22.20.0 bundled (HIGH confidence)
- [electron-vite Getting Started](https://electron-vite.org/guide/) — Confirmed v5.0.0, Vite-based, main/renderer/preload split (HIGH confidence)
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide) — Full hook event table, stdin/stdout contract, UserPromptSubmit, PostToolUse schemas (HIGH confidence — official docs)
- [npm trends: electron-builder vs electron-forge](https://npmtrends.com/electron-builder-vs-electron-forge) — Download count confirmation (MEDIUM confidence)
- [Why Electron Forge](https://www.electronforge.io/core-concepts/why-electron-forge) — Alternative perspective from Forge team (MEDIUM confidence)
- [Electron Window Customization docs](https://www.electronjs.org/docs/latest/tutorial/window-customization) — transparent/frameless/alwaysOnTop BrowserWindow patterns (HIGH confidence)
- [PostToolUse hooks cannot inject context issue](https://github.com/anthropics/claude-code/issues/18427) — Confirms hooks use `additionalContext` for UserPromptSubmit, not PostToolUse (MEDIUM confidence — GitHub issues)
- WebSearch: screen.getCursorScreenPoint Linux regression — Known bug in v29-v38 range, flagged as pitfall (MEDIUM confidence)

---
*Stack research for: Electron cross-platform screenshot capture CLI + Claude Code integration*
*Researched: 2026-03-16*
