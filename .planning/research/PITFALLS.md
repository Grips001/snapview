# Pitfalls Research

**Domain:** Electron-based screen capture CLI tool (snapview)
**Researched:** 2026-03-16
**Confidence:** HIGH (multiple official sources, active GitHub issue threads, platform-specific documentation)

---

## Critical Pitfalls

### Pitfall 1: macOS Screen Recording Permission — Silent Failure and Sequoia Re-prompting

**What goes wrong:**
On macOS, `desktopCapturer.getSources()` never resolves if screen recording permission has not been granted — it simply hangs indefinitely rather than rejecting or throwing. The user sees a frozen overlay with no feedback. Separately, macOS Sequoia (15.x) added a recurring permission re-prompt (initially weekly, settled to monthly as of 15.1) that requires the user to reconfirm permission. Apps that assume a one-time grant will silently stop working until the user goes back to System Settings.

**Why it happens:**
Chromium's internal permission gate halts the promise without notifying the renderer process. Developers test on a machine where permission is already granted and never encounter the hang. The Sequoia change was introduced in 2024 and caught many existing tools off-guard — the Kap screen recorder had a well-documented incident (GitHub issue #1231).

**How to avoid:**
- Before calling `getSources()`, call `systemPreferences.getMediaAccessStatus('screen')` and check the result.
- If status is `'not-determined'`, call `systemPreferences.askForMediaAccess('screen')` and await the result.
- If status is `'denied'`, show a visible error instructing the user to open System Settings > Privacy > Screen Recording.
- Never rely on the `getSources()` promise resolving as a proxy for "permission granted."
- Display explicit messaging explaining that macOS Sequoia will prompt monthly — frame it as expected OS behavior, not a bug.

**Warning signs:**
- App hangs on first launch on a fresh macOS install.
- Users on Sequoia reporting the tool "stopped working" after a month.
- No error or rejection logged from `getSources()` — just silence.

**Phase to address:** Phase 1 (Core capture implementation) — build the permission check gate before any capture logic.

---

### Pitfall 2: Transparent Overlay Window Fails Silently on Linux Without GPU Flags

**What goes wrong:**
On Linux, a `BrowserWindow` with `transparent: true` renders as an opaque gray or black rectangle on systems with certain NVIDIA drivers or when running under X11 without the correct GPU flags (`--enable-transparent-visuals --disable-gpu`). The selection overlay appears as a solid block rather than a see-through overlay, making region selection impossible. On Wayland the situation is worse: the XDP portal may crash Electron when the user dismisses the portal picker (tracked in electron/electron#45198).

**Why it happens:**
Linux alpha-channel compositing requires explicit GPU configuration flags that are not enabled by default. This is a known upstream Chromium bug. Wayland screen capture is routed through xdg-desktop-portal + PipeWire which has its own lifecycle separate from Electron's window management — if the portal dialog is closed by the user instead of confirmed, Electron crashes rather than rejecting cleanly.

**How to avoid:**
- Pass `--enable-transparent-visuals` and `--disable-gpu` as `app.commandLine.appendSwitch()` entries when running on Linux X11. Gate this behind platform detection (`process.platform === 'linux'`).
- For Wayland, wrap the `getSources()` call in a try/catch and add a crash handler via `process.on('uncaughtException')` to convert the portal dismissal into a recoverable error state.
- Test on both X11 and Wayland sessions during development — they behave differently.
- Consider falling back to a non-transparent dimmed-overlay approach on Linux if transparency is unreliable.

**Warning signs:**
- Overlay renders as solid color on any Linux test machine.
- `process.crash()` or unhandled rejection when user closes the portal picker without selecting.
- CI/CD tests pass but manual Linux QA fails.

**Phase to address:** Phase 1 (Core capture) with explicit cross-platform testing gate before shipping.

---

### Pitfall 3: Electron Cold-Start Latency Destroys the "Under 3 Seconds" UX Goal

**What goes wrong:**
An unoptimized Electron app cold-starts in 800ms–2000ms before showing any window. For snapview, which targets a "feel instant" capture experience, this means the user invokes `/snapview`, waits 1–2 seconds staring at nothing, then sees the overlay. The tool feels broken rather than fast.

**Why it happens:**
Electron loads Chromium + Node.js + your renderer JS synchronously. Every `require()` at startup — even for modules you don't need immediately — adds latency. Developers don't notice this during development because V8 caches warm up after the first run and dev machines are fast.

**How to avoid:**
- Defer all non-critical `require()` calls (image processing, file I/O utilities) until after the window is shown.
- Show the overlay window shell immediately on `ready-to-show` before the renderer is fully initialized.
- Keep the main process lean — move all heavy logic to the renderer or a utility process.
- Consider a "pre-warm" strategy: launch Electron as a background daemon on tool install, so subsequent invocations reuse the running process. This is the most effective approach for sub-500ms perceived startup.
- Profile with Chrome DevTools Timeline before declaring startup complete — measure from `app.on('ready')` to `BrowserWindow.show()`.

**Warning signs:**
- Startup takes >500ms on a cold macOS M-series machine.
- Main process is doing file I/O or `require('sharp')` / similar heavy libraries at app init.
- Users report a visible "nothing happens" delay after invoking the command.

**Phase to address:** Phase 1 (initial implementation) — establish startup baseline. Phase 2 (polish) — enforce the <1 second target with profiling.

---

### Pitfall 4: Path Resolution Breaks After Global npm/bun Install and Packaging

**What goes wrong:**
`__dirname` points to the Electron app's internal ASAR bundle location, not to where `npm install -g` placed the package. Any code that constructs paths relative to `__dirname` for finding assets, templates, or the hook installer scripts will work in local development and break completely after global install. The failure mode is usually a silent file-not-found error that manifests as "nothing happens" when running the CLI.

**Why it happens:**
Electron apps have three different path contexts: development (`node_modules/electron-prebuilt`), packaged ASAR, and globally installed. Developers test in development mode only and assume `__dirname` is stable. ASAR packaging maps paths into the virtual archive, which does not match the filesystem location that `npm i -g` uses.

**How to avoid:**
- Use `app.getAppPath()` (inside Electron context) instead of `__dirname` for all asset paths.
- Use `process.cwd()` only for user-facing working directory operations (e.g., reading the user's project files).
- For the CLI bootstrap script (the Node.js entrypoint that launches Electron), use `import.meta.url` or `require.resolve()` relative to the CLI file itself — not `__dirname` from the Electron binary.
- Write integration tests that run the tool via `npx snapview` (simulating global install) rather than `node .` from the repo root.

**Warning signs:**
- Hook installer fails with ENOENT after `npm i -g snapview`.
- Asset paths hard-coded as `path.join(__dirname, '..', 'assets', '...')`.
- Works on the developer's machine, breaks on fresh install.

**Phase to address:** Phase 1 (distribution architecture) — establish path resolution strategy before writing any code that reads files.

---

### Pitfall 5: desktopCapturer Black Screen on Other Electron / Chromium-Based Apps

**What goes wrong:**
When the user tries to capture a window that is itself an Electron or Chromium-based application (VS Code, Claude Code's Electron shell, browsers, Slack, Discord), `desktopCapturer` returns a black thumbnail or a black video frame instead of the window content.

**Why it happens:**
This is a documented, long-standing upstream Chromium limitation (electron/electron#21687). Chrome-based processes use GPU compositing that is not shared across process boundaries in the same way as native windows. The capture happens before the GPU output is composited, yielding a black frame.

**How to avoid:**
- For screenshot (single frame), switch from `getUserMedia` + video stream to using `desktopCapturer.getSources()` with `thumbnailSize` set to the actual desired dimensions — thumbnails bypass some of the GPU compositing path and are more reliable for static captures.
- Test specifically against VS Code and a Chromium browser as part of the QA checklist — these are high-probability targets for users screenshotting their IDE.
- Document this as a known limitation for full-window captures of Electron apps; region captures from `screen` sources (not `window` sources) sidestep this issue entirely.

**Warning signs:**
- Black rectangles in preview for any VS Code window capture.
- Works fine for native app windows (Finder, Terminal) but fails for browser/Electron windows.

**Phase to address:** Phase 1 (capture implementation) — use `screen` source type by default rather than `window` sources to avoid this class of problem.

---

### Pitfall 6: Claude Code Hook Subprocess Hangs Indefinitely

**What goes wrong:**
Claude Code hooks that launch a subprocess (snapview's Electron app) and wait for it to complete can hang the Claude Code session forever if the Electron process stalls, crashes silently, or if the user closes the overlay without completing the capture. There is no configurable timeout for most hook types in Claude Code, and MCP-related calls have documented issues with indefinite hangs (anthropics/claude-code#15945).

**Why it happens:**
Hook scripts are typically implemented as shell scripts or Node.js scripts that `await` the subprocess exit. If the Electron app never exits (due to an unhandled exception, a modal dialog blocking exit, or an OS permission dialog that is never dismissed), the hook never returns and the Claude Code session appears frozen.

**How to avoid:**
- The Electron app must always exit cleanly — implement a hard timeout inside the Electron app itself (e.g., `setTimeout(() => app.quit(), 30000)` as a backstop).
- Handle all escape/cancel paths explicitly: pressing Escape, clicking outside the overlay, and OS-level window close all need to call `app.quit()`.
- The hook script should wrap the subprocess call with a timeout (e.g., `timeout 30 snapview capture` on Unix).
- Output the result file path to stdout on success, a non-zero exit code on failure — hooks should communicate outcome through exit codes, not just file presence.

**Warning signs:**
- Claude Code session unresponsive after invoking `/snapview`.
- No `app.quit()` call in the overlay's cancel/dismiss handlers.
- Hook script has no timeout wrapper.

**Phase to address:** Phase 2 (Claude Code integration hooks) — design the exit protocol before writing hook scripts.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip macOS permission pre-check, rely on `getSources()` | Simpler code | Silent hangs for users without permission; impossible to debug | Never |
| Use `window` source type instead of `screen` for capture | Easier region targeting | Black screens on Chromium-based apps (VS Code, browser) | Never for primary path |
| Hard-code `__dirname` for asset paths | Works in dev | Breaks on every global install | Never |
| No timeout on Electron subprocess in hook | Simpler hook script | Permanently hangs Claude Code session on any Electron crash | Never |
| Single-platform testing during development | Faster iteration | Linux/Windows issues discovered at release | Only in Phase 1 proof-of-concept |
| Ship without code signing | Avoids certificate cost | Windows SmartScreen blocks install; AV false positives | Never for public release |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude Code hooks | Hook waits for Electron subprocess to exit, no timeout | Add `timeout 30` wrapper; Electron app always calls `app.quit()` on all paths |
| Claude Code file injection | Writing the screenshot to the project directory | Write to OS temp dir (`app.getPath('temp')`), pass absolute path to hook output |
| Claude Code hooks | Assuming hooks have access to Claude session env vars | Test hook scripts in a clean environment with only `PATH` set |
| npm/bun global install | Electron binary not found after install | Ensure `bin` field in `package.json` points to the launcher script, not the Electron binary directly |
| macOS `desktopCapturer` | Calling `getSources()` without prior permission check | Always call `systemPreferences.getMediaAccessStatus('screen')` first |
| Linux Wayland | Assuming X11 behavior applies | Test explicitly on Wayland session; handle XDP portal crash path |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Cold-starting Electron on every invocation | >1s perceived lag from CLI invocation to overlay visible | Pre-warm daemon or optimize main-process require() calls | Every single invocation |
| Setting large `thumbnailSize` in `getSources()` | `getSources()` takes 500ms+ to return | Set thumbnail dimensions to match actual display resolution; avoid 4K thumbnails on 1080p use | First test on Retina/HiDPI display |
| Loading renderer bundle synchronously before showing window | Window appears late; spinner shows | Show window shell immediately, load heavy assets after `ready-to-show` | Cold start on any machine |
| Accumulating temp files (no cleanup) | OS temp dir grows unbounded across sessions | Implement cleanup on `app.quit()` + a startup sweep for files older than 24h | After ~100 captures |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Leaving screenshots in temp dir indefinitely | Screenshots of sensitive content persist on disk; accessible to other processes | Clean up on `app.quit()` + sweep on startup for files >24h old |
| Shipping without `contextIsolation: true` and `nodeIntegration: false` | Remote content (if any) can access Node.js APIs; known Electron attack vector | Set these in `webPreferences` from the start; use `contextBridge` for renderer communication |
| Shipping unsigned binaries on Windows | Windows Defender SmartScreen blocks install with "unrecognized app" warning; false positive AV detection | Code-sign with a trusted certificate before any public distribution |
| Storing screenshot paths in a predictable temp location | Symlink attack: attacker pre-creates the path and redirects the write | Use `os.tmpdir()` + cryptographically random filename (e.g., `crypto.randomBytes(16).toString('hex')`) |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No visual feedback between CLI invocation and overlay appearing | User re-runs command thinking it failed; double-captures | Show a system tray icon or brief OS notification immediately at launch |
| Overlay appears on wrong monitor in multi-monitor setups | User cannot access the right screen for capture | Default overlay to the display containing the cursor (`screen.getCursorScreenPoint()`) |
| No visible cancel affordance on overlay | User trapped in capture mode; must kill process | Show visible "Press Escape to cancel" text; handle `Escape` keydown explicitly |
| Capture preview too small to evaluate quality | User approves blurry/wrong screenshot without knowing | Show preview at 1:1 or 50% scale with scrolling, not scaled-to-fit thumbnail |
| No retake flow — capture commits immediately | User cannot recover from an accidental wrong region selection | Implement approve/retake before writing the temp file |

---

## "Looks Done But Isn't" Checklist

- [ ] **macOS permission flow:** Works on a machine where permission was never granted — verify both "grant" and "deny" paths show user-visible feedback, not a hang.
- [ ] **Linux transparency:** Overlay is actually transparent (not gray/black) on a real Linux X11 session with NVIDIA drivers.
- [ ] **Global install paths:** Run `npm pack && npm install -g ./snapview-*.tgz` and verify hook installer and capture all work — do not test only via `node .`.
- [ ] **Claude Code hook hang:** Kill the Electron process mid-capture (simulates crash) and verify the Claude Code session recovers and does not hang.
- [ ] **Temp file cleanup:** Run 10 captures in a row, then verify temp dir contains only the most recent file (or none after a session).
- [ ] **Multi-monitor:** Invoke on a two-monitor system and verify the overlay appears on the correct screen.
- [ ] **Chromium window capture:** Attempt to capture a VS Code window — verify it does not produce a black rectangle (use `screen` source, not `window` source).
- [ ] **Sequoia re-prompt:** On macOS 15.x, verify the app handles the monthly re-prompt gracefully rather than silently failing.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Path resolution broken after global install | MEDIUM | Add `app.getAppPath()` usage throughout; add integration test for global install path; patch release |
| macOS permission silent hang shipped | MEDIUM | Add permission pre-check in a patch release; add clear error UI |
| Hook hanging on Electron crash | HIGH | Requires hook rewrite + new Electron exit protocol + user instructions to update |
| Unsigned binary blocked by Windows SmartScreen | HIGH | Requires purchasing code signing certificate + re-releasing signed binaries + user communication |
| Linux overlay black on launch | MEDIUM | Gate `--disable-gpu` flag behind platform check; patch release |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| macOS permission silent hang | Phase 1 — Core capture | Test on fresh macOS VM with no screen recording permissions granted |
| Linux overlay transparency failure | Phase 1 — Core capture | Run on Linux X11 + Wayland, check for non-transparent render |
| Electron cold-start >1 second | Phase 1 — initial, Phase 2 — enforce | Measure `app.ready` to `BrowserWindow.show()` with Chrome tracing |
| Path resolution breaks after global install | Phase 1 — distribution architecture | Run `npm install -g` from tarball, invoke tool, verify no ENOENT |
| Black screen on Chromium window capture | Phase 1 — capture implementation | Test capture of VS Code window specifically |
| Claude Code hook subprocess hang | Phase 2 — hooks integration | Kill Electron mid-capture, verify Claude session recovers |
| Temp file accumulation | Phase 1 — storage design | Run 20 captures, check temp dir size |
| Windows SmartScreen block | Phase 3 — distribution/release | Install on fresh Windows VM, observe SmartScreen behavior |
| macOS Sequoia monthly re-prompt | Phase 2 — macOS polish | Test on macOS 15.x specifically with `tccutil reset ScreenCapture` to trigger re-prompt |

---

## Sources

- [Electron desktopCapturer permission check PR #43080](https://github.com/electron/electron/pull/43080)
- [desktopCapturer getSources not working issue #33125](https://github.com/electron/electron/issues/33125)
- [Linux XDP crash when portal dismissed #45198](https://github.com/electron/electron/issues/45198)
- [Electron screen capture failure on Chromium apps #21687](https://github.com/electron/electron/issues/21687)
- [Electron transparent window black/gray background #40515](https://github.com/electron/electron/issues/40515)
- [macOS Sequoia screen recording monthly permission prompt — 9to5Mac](https://9to5mac.com/2024/10/07/macos-sequoia-screen-recording-popups/)
- [Kap macOS M1 screen recording permission issue #1231](https://github.com/wulkano/Kap/issues/1231)
- [Claude Code MCP 16+ hour hang with no timeout #15945](https://github.com/anthropics/claude-code/issues/15945)
- [Electron Windows stdout \r\n issue #12578](https://github.com/electron/electron/issues/12578)
- [Electron ASAR native module unpack issue #1285](https://github.com/electron-userland/electron-builder/issues/1285)
- [Electron startup performance optimization — Astrolytics](https://www.astrolytics.io/blog/optimize-electron-app-slow-startup-time)
- [Electron transparent window click-through limitation #1335](https://github.com/electron/electron/issues/1335)
- [Electron tmp file cleanup issue #40630](https://github.com/electron/electron/issues/40630)
- [Windows Defender false positive on unsigned Electron apps — electron-builder #1894](https://github.com/electron-userland/electron-builder/issues/1894)
- [Electron __dirname webpack path resolution #5424](https://github.com/webpack/webpack/issues/5424)
- [Challenges building an Electron app (2024) — Daniel Corin](https://www.danielcorin.com/posts/2024/challenges-building-an-electron-app/)

---
*Pitfalls research for: Electron screen capture CLI tool (snapview)*
*Researched: 2026-03-16*
