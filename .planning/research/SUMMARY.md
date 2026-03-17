# Project Research Summary

**Project:** Snapview
**Domain:** Cross-platform screenshot capture CLI tool with Claude Code AI session integration
**Researched:** 2026-03-16
**Confidence:** HIGH

## Executive Summary

Snapview is a globally-installable CLI tool that launches an Electron-based screen capture overlay, captures a user-selected region, and injects the resulting screenshot directly into an active Claude Code session. The expert approach is: a thin Node.js CLI wrapper spawns an Electron binary (bundled via the `electron` npm package) which presents a transparent fullscreen overlay for drag-to-select region capture, writes a PNG to the OS temp directory, and outputs the file path to stdout — which Claude Code reads using its native Read tool. This architecture sidesteps OS-specific dependencies, avoids MCP server complexity, and leverages Claude Code's existing file injection mechanism rather than inventing a new one.

The recommended implementation uses Electron 35.x (not the newer v39 which has known Linux regressions), TypeScript 5.x, electron-vite for the build pipeline, and electron-builder for packaging. No external image library is needed — Electron's built-in `nativeImage`, `desktopCapturer`, and `screen` APIs handle all capture and crop operations. The differentiation is real and uncontested: no existing tool (CleanShot X, ShareX, or Hammerspoon DIY scripts) combines cross-platform CLI installation, direct AI session injection, and hooks-based auto-trigger in a single `npm i -g` install.

The three non-negotiable risks are: (1) macOS screen recording permissions that hang silently if not pre-checked before calling `desktopCapturer.getSources()`, (2) Linux transparent overlay failures on X11/NVIDIA without explicit GPU flags, and (3) Claude Code hook subprocess hangs if Electron has no hard-exit timeout on all cancel/dismiss paths. These must be addressed in Phase 1 — they are not polish issues. Code signing must also be addressed before any public Windows distribution or SmartScreen will block installation.

## Key Findings

### Recommended Stack

The stack is narrow and well-justified. Electron provides the cross-platform desktop runtime without requiring OS-specific screenshot tools, eliminating the key constraint from the project requirements. `electron-vite` is preferred over Electron Forge because it handles the main/renderer/preload split natively and has significantly higher real-world adoption. `electron-builder` handles packaging and ASAR bundling. The CLI entry point is a CommonJS Node.js script that calls `require('electron')` to locate the bundled binary, then spawns it — this is the same pattern VS Code uses for its `code` CLI wrapper.

**Core technologies:**
- **Electron 35.x:** Cross-platform desktop runtime with bundled Chromium+Node — eliminates OS screenshot tool dependencies; pin to 35.x (not 39.x which has Linux cursor regression bugs)
- **TypeScript 5.x:** Type safety across main/renderer/preload; catches IPC contract mismatches at compile time, the #1 source of Electron bugs
- **electron-vite 5.x:** Build tooling that understands Electron's split environment; provides hot-reload; simpler config than raw Vite+plugins
- **electron-builder 26.x:** Packages the Electron binary and handles ASAR; more escape hatches than Electron Forge for the npm-global-distribution pattern
- **commander 12.x:** Lightweight CLI argument parsing for the Node.js wrapper; yargs is overkill for a focused single-purpose CLI
- **nativeImage (built-in):** Crop and encode screenshots to PNG — no external image library needed for v1

### Expected Features

No existing tool combines all three of Snapview's distinguishing properties. The feature set is well-scoped. Annotation, video recording, OCR, and cloud upload are anti-features for v1 — they either duplicate Claude's native capabilities, contradict the ephemeral privacy contract, or double project scope.

**Must have (table stakes):**
- Drag-to-select region capture with crosshair cursor — core product; absence is immediately jarring
- Capture preview with approve/retake — required for user trust; without it the tool is unusable on first mistake
- Temp file write + path injection into Claude Code — the entire value proposition depends on this mechanism
- `/snapview` skill command (manual trigger) — entry point for users before hooks integration
- Cross-platform operation (Windows, macOS, Linux) — non-negotiable given Claude Code's developer user base
- ESC to cancel and visible cancel affordance — universal overlay expectation
- `npm i -g snapview` single install command — CLI tool friction kills adoption
- 24-hour temp file auto-cleanup — ships with the ephemeral promise intact

**Should have (competitive):**
- Auto-trigger via Claude Code hooks (`UserPromptSubmit` / `PostToolUse`) — the primary differentiator; zero-friction AI-initiated capture
- Global hotkey (configurable) — reduces reliance on terminal focus to trigger capture
- Window-snap selection assist — highlights window boundaries on hover; reduces imprecise drag-selects
- Pixel-level magnifier during selection — value for developers debugging precise UI boundaries
- Clipboard copy alongside injection — standard screenshot behavior; easy add

**Defer (v2+):**
- Annotation tools (arrows, text, boxes) — adds significant scope; Claude's vision handles un-annotated screenshots well
- Configurable output format (PNG/JPEG) — PNG is fine for all current use cases; add only if file size becomes a complaint
- Capture history (session-scoped) — not needed to validate the core loop
- Multi-screenshot batch capture — complicates injection mechanism; user can invoke twice

### Architecture Approach

The architecture has four discrete layers: (1) a Claude Code layer (skill + hooks config) that triggers the CLI, (2) a Node.js CLI entry point (`bin/snapview.cjs`) that spawns the Electron process, (3) the Electron app (main process, renderer, preload bridge) that handles the capture UI and file output, and (4) an installer component that writes the skill and hooks config to `~/.claude/`. Each invocation is stateless — the Electron app launches, the user selects a region, the PNG is written to `os.tmpdir()/snapview/`, the path is printed to stdout, and the process exits. No server, no daemon, no persistent state.

**Major components:**
1. **CLI Entry Point (`bin/snapview.cjs`)** — locates the bundled Electron binary via `require('electron')`, spawns the app, pipes stdout back to Claude Code
2. **Installer (`snapview install`)** — writes SKILL.md to `~/.claude/skills/snapview/` and merges hooks config into `~/.claude/settings.json` without overwriting existing entries
3. **Electron Main Process (`src/main/index.ts`)** — creates the transparent overlay BrowserWindow, handles IPC from renderer, calls `desktopCapturer.getSources()`, crops with `nativeImage`, writes PNG to temp dir
4. **Preload Bridge (`src/preload/preload.ts`)** — `contextBridge.exposeInMainWorld` exposes only the IPC channels the renderer needs; `contextIsolation: true` + `nodeIntegration: false` always
5. **Overlay Renderer (`src/renderer/app.ts`)** — fullscreen canvas for drag-to-select; preview panel with approve/retake; communicates exclusively through the preload bridge
6. **File Output + Cleanup (`src/main/capture.ts`, `cleanup.ts`)** — writes to `os.tmpdir()/snapview/snapview-{timestamp}-{random}.png`; startup sweep deletes files older than 24 hours

### Critical Pitfalls

1. **macOS silent hang on missing screen recording permission** — `desktopCapturer.getSources()` hangs indefinitely (never rejects) if permission is not granted. Always call `systemPreferences.getMediaAccessStatus('screen')` before `getSources()` and show explicit UI for denied/not-determined states. Also handle macOS Sequoia's monthly re-prompt cycle.

2. **Linux transparent overlay failure** — On X11 with NVIDIA drivers, `transparent: true` renders as opaque gray/black without `--enable-transparent-visuals --disable-gpu` flags. On Wayland, dismissing the XDP portal picker crashes Electron rather than rejecting cleanly. Gate the GPU flags behind `process.platform === 'linux'` and wrap the Wayland portal path in try/catch.

3. **Claude Code hook subprocess hang** — If the Electron app stalls or crashes, the hook script waiting for it hangs the entire Claude Code session indefinitely. The Electron app must call `app.quit()` on every code path (ESC, click-outside, OS close, and an internal 30-second hard timeout). The hook script must wrap the call with a `timeout 30` guard.

4. **Path resolution breaks after global install** — `__dirname` in Electron ASAR context does not match the filesystem location of a globally-installed npm package. Use `app.getAppPath()` inside Electron for all asset paths. Never hard-code `__dirname`-relative paths. Verify with `npm pack && npm install -g ./snapview-*.tgz`, not just `node .`.

5. **Black screen when capturing Chromium-based windows (VS Code, browsers)** — GPU compositing across Electron/Chrome processes produces black thumbnails. Use `screen` source type by default (not `window` sources) — `screen` sources bypass this limitation. Document the remaining edge case for full-window captures of Electron apps.

## Implications for Roadmap

Based on combined research, a 4-phase structure is recommended. Phases 1 and 2 are load-bearing — they establish the core capture loop and the Claude Code integration. Phases 3 and 4 add quality and competitive features.

### Phase 1: Core Capture Foundation

**Rationale:** All other features depend on a working capture loop. The pitfalls research shows that macOS permissions, Linux transparency, path resolution, and Chromium black screens must all be designed correctly from the start — these are architectural decisions, not fixable patches. This phase proves the core value proposition.

**Delivers:** Working cross-platform screenshot capture with region selection, preview, approve/retake, temp file output, and a functional CLI entry point. Verifiable on Windows, macOS, and Linux.

**Addresses:** Region capture overlay, capture preview, temp file write, cross-platform operation, auto-cleanup, `npm i -g` install

**Avoids:** macOS silent permission hang (build permission gate before capture logic), Linux overlay failure (add GPU flags from day one), black screen on Chromium windows (use `screen` source type), path resolution breakage (use `app.getAppPath()` from the start)

### Phase 2: Claude Code Integration

**Rationale:** Once capture is proven, wire it into Claude Code. The skill and hook installer are simple in concept but have their own gotchas (settings.json merging, hook subprocess hang, skill frontmatter). These need to be designed as a unit — skill and hook are complementary, not independent.

**Delivers:** `/snapview` slash command in Claude Code, `snapview install` installer, hooks-based auto-trigger, and the `additionalContext` stdout protocol. Claude can request and receive screenshots with no user friction.

**Addresses:** `/snapview` skill command, auto-trigger via Claude hooks, `snapview install` command

**Avoids:** Claude Code hook hang (implement 30-second Electron hard-exit + `timeout 30` hook wrapper), skill `disable-model-invocation` (must be `true` — model-invoked capture is disruptive), hook settings merge (read-modify-write, not overwrite)

### Phase 3: UX Polish and Quality

**Rationale:** After the core loop is validated, optimize for the user experience that makes the tool feel professional. This phase directly addresses the UX pitfalls research identified: multi-monitor targeting, launch latency, and the small quality-of-life features that determine whether developers keep the tool installed.

**Delivers:** Sub-1-second perceived launch, correct multi-monitor overlay placement, clipboard copy, global hotkey, and the "Looks Done But Isn't" checklist items (Sequoia re-prompt handling, temp file accumulation test, hook hang recovery test)

**Addresses:** Fast launch time (pre-warm strategy or startup optimization), global hotkey, clipboard copy, multi-monitor overlay placement, macOS Sequoia monthly re-prompt

**Avoids:** Launch latency destroying the "under 3 seconds" goal, overlay appearing on wrong monitor, no cancel affordance trapping users

### Phase 4: Competitive Differentiators + Distribution Readiness

**Rationale:** Once the tool is polished, add the features that move it from "useful" to "preferred." Code signing is gated here because it requires a certificate purchase but is required for public Windows distribution. Window-snap and pixel magnifier are developer-quality-of-life features that compete directly with CleanShot X.

**Delivers:** Window-snap selection assist, pixel-level magnifier during drag, code-signed binaries (Windows SmartScreen compliance), and `npx snapview` zero-install invocation

**Addresses:** Window-snap selection assist, pixel magnifier, signed Windows binary, clean public release

**Avoids:** Windows SmartScreen blocking install (ship unsigned only in dev; must sign before public release)

### Phase Ordering Rationale

- Phase 1 before everything else: capture is the foundation; no Claude integration is testable without it
- Platform-specific pitfalls (macOS permissions, Linux GPU flags) must be in Phase 1 because they affect the core architecture — retrofitting them is expensive
- Claude Code integration in Phase 2 (not Phase 1) because hooks/skills are testable independently of polish; keeping scope focused accelerates validation
- UX polish in Phase 3 because users will tolerate rough edges during validation but not in a production-ready release
- Code signing in Phase 4 because it has a cost barrier and should only be incurred when the product is ready for public distribution

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Claude Code Integration):** Hook auto-trigger signal design needs validation — whether to use structured JSON output from Claude or pattern-match natural language. The research flags uncertainty about the exact `PostToolUse` vs `UserPromptSubmit` hook choice for auto-trigger. GitHub issue #18427 confirms `additionalContext` works for `UserPromptSubmit` but not `PostToolUse`.
- **Phase 4 (Distribution):** Windows code signing certificate procurement and the `electron-builder` code signing config are well-documented but require external verification of current pricing and certificate vendor options.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Core Capture):** All APIs are well-documented in official Electron docs. Patterns are established. Pitfalls are known and prevention strategies are clear.
- **Phase 3 (UX Polish):** Standard Electron optimization techniques; no novel patterns required.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core technologies verified against official Electron docs, electron-vite docs, and Claude Code official docs. Version pins are well-reasoned. |
| Features | HIGH | Competitor analysis is thorough; feature boundaries (what to include vs defer) are clear and well-justified. MEDIUM for AI-integration patterns specifically. |
| Architecture | HIGH | Data flow is derived from official Electron IPC docs and Claude Code hooks/skills reference. All anti-patterns are verified against actual Electron issues. |
| Pitfalls | HIGH | Every critical pitfall is backed by a specific GitHub issue or official documentation. Prevention strategies are concrete. |

**Overall confidence:** HIGH

### Gaps to Address

- **Hook trigger signal format:** The research recommends structured JSON output from Claude as the auto-trigger signal (more reliable than natural language regex), but the exact JSON schema that Claude should emit needs to be defined during Phase 2 planning. Validate whether Claude can reliably produce a consistent signal format.
- **Wayland support scope:** The research identifies Wayland as a crash risk (XDP portal dismissal) and recommends a try/catch fallback, but the full extent of Wayland compatibility issues is marked MEDIUM confidence. Consider explicitly scoping Linux support to X11 for v1 and treating Wayland as a v1.x stretch goal.
- **Pre-warm daemon trade-offs:** The research identifies "pre-warm Electron as a background daemon" as the most effective startup latency solution but notes it conflicts with "no background process unless active" user expectations. This design tension needs an explicit decision during Phase 3 planning.
- **Electron version stability:** Research recommends pinning to 35.x due to v39 Linux regressions. This should be validated closer to implementation as the Electron release cadence may resolve known regressions.

## Sources

### Primary (HIGH confidence)
- [Electron desktopCapturer API](https://www.electronjs.org/docs/latest/api/desktop-capturer) — capture API, platform limitations, permission requirements
- [Electron Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model) — main/renderer architecture
- [Electron IPC docs](https://www.electronjs.org/docs/latest/tutorial/ipc) — ipcMain/ipcRenderer patterns
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) — hook events, JSON schema, handler types
- [Claude Code Skills Reference](https://code.claude.com/docs/en/skills) — SKILL.md frontmatter, invocation control
- [electron-vite Getting Started](https://electron-vite.org/guide/) — v5.0.0 confirmed, Vite-based build

### Secondary (MEDIUM confidence)
- [electron/electron#45198](https://github.com/electron/electron/issues/45198) — Linux XDP portal crash on Wayland
- [electron/electron#21687](https://github.com/electron/electron/issues/21687) — Black screen on Chromium window capture
- [electron/electron#40515](https://github.com/electron/electron/issues/40515) — Transparent window black background
- [anthropics/claude-code#18427](https://github.com/anthropics/claude-code/issues/18427) — PostToolUse `additionalContext` limitation
- [anthropics/claude-code#15945](https://github.com/anthropics/claude-code/issues/15945) — Hook subprocess hang with no timeout
- [macOS Sequoia screen recording prompt — 9to5Mac](https://9to5mac.com/2024/10/07/macos-sequoia-screen-recording-popups/)
- [quobix.com: Screenshots with Claude Code](https://quobix.com/articles/screenshots-with-claude-code/) — validates the user problem Snapview solves

### Tertiary (LOW confidence)
- [npm trends: electron-builder vs electron-forge](https://npmtrends.com/electron-builder-vs-electron-forge) — download count comparison, confirms electron-builder dominance
- Competitor feature analysis (CleanShot X, ShareX, Shottr, Hammerspoon) — confirms differentiation is real and uncontested

---
*Research completed: 2026-03-16*
*Ready for roadmap: yes*
