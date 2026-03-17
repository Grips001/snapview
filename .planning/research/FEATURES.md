# Feature Research

**Domain:** Screenshot capture tool with AI CLI assistant integration
**Researched:** 2026-03-16
**Confidence:** HIGH (core features), MEDIUM (AI-integration patterns)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Drag-to-select region capture | Every screenshot tool has click-drag area selection; absence is jarring | LOW | Electron `desktopCapturer` + transparent overlay window; crosshair cursor is expected UX |
| Full-screen capture mode | Quickest fallback when region select is overkill | LOW | Single call to `desktopCapturer.getSources`; still needs to flow through same preview/approve path |
| Capture preview before send | Users need to confirm the right region was captured before it goes to Claude | MEDIUM | Overlay or popup window showing the captured image; approve/retake buttons |
| Retake (discard and recapture) | Misclicks happen; without retake the tool is frustrating on first mistake | LOW | Relaunch the selection overlay; cheap to implement, high UX cost if missing |
| Keyboard-driven dismissal | ESC to cancel is a universal expectation for overlay UIs | LOW | `globalShortcut` or keydown listener on the overlay window |
| Global shortcut trigger | Users expect a hotkey they can press from anywhere, not just from the terminal | MEDIUM | Electron `globalShortcut`; configurable binding stored in user config |
| Clipboard copy of captured image | Standard screenshot behavior; users may want to paste into tools other than Claude | LOW | `nativeImage` → `clipboard.writeImage()`; should happen automatically |
| Output to file (temp path) | Required for injection into Claude via the Read tool | LOW | Write PNG to `os.tmpdir()`; this is the primary injection mechanism |
| Cross-platform operation | Windows, macOS, Linux; developers use all three | HIGH | Electron covers the runtime, but platform-specific APIs differ (e.g., permissions on macOS, Wayland on Linux) |
| Fast launch time | Capture UI appearing slowly destroys the "under 3 seconds" core value | MEDIUM | Electron cold start is slow; pre-warm strategy (hidden window on startup) is the standard solution |
| Single install command | CLI tool users expect `npm i -g snapview` and done | LOW | Standard npm/bun package; `bin` field in `package.json`; no secondary install steps |

---

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Auto-trigger via Claude hooks | Claude can request a screenshot and the capture UI launches without user typing `/snapview` — zero-friction visual context | HIGH | Requires hooks-based integration with Claude Code; the hooks system can intercept tool calls or custom events; this is the primary differentiator vs general-purpose screenshot tools |
| Claude Code session injection | Image goes directly into the active Claude conversation via temp file + Read tool — no drag-and-drop, no file manager | MEDIUM | Temp file written to `os.tmpdir()`, absolute path returned to Claude via stdout or hooks response; leverages existing Claude Code `Read` tool capability |
| `/snapview` skill command | Natural language trigger inside Claude Code conversation — feels native to the workflow | LOW | SKILL.md or Claude Code `commands` directory entry; calls the CLI binary |
| Pixel-level magnifier during selection | Lets users select precise UI boundaries (1px button borders, text baselines) | MEDIUM | Render a zoomed callout near the cursor during drag; CleanShot X and Shottr do this; high value for developers inspecting UI bugs |
| Self-cleaning ephemeral storage | Screenshots auto-purge within 24 hours — no accumulation of sensitive screen data | LOW | On startup, scan temp dir for `snapview-*` files older than 24h and delete; no external scheduler needed |
| Window-snap selection assist | Hovering over a window highlights it as a capture candidate; click to capture exactly that window | MEDIUM | Use `desktopCapturer` window enumeration + overlay hit detection; reduces drag-select effort for common case |
| Configurable output format | PNG for lossless quality (default), JPEG for smaller size when image quality is less critical | LOW | `sharp` or `nativeImage` format conversion at save time; user config flag |
| Capture history (session-scoped) | See the last N captures taken this session; retransmit any prior capture to Claude | MEDIUM | In-memory list of temp file paths; UI to browse and re-inject; complements retake flow |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Annotation tools (arrows, boxes, text) | Users want to highlight what they're asking about before sending | Adds significant scope: annotation canvas, tool palette, undo history, text input; easy to get 80% right, hard to get right; Claude can identify regions verbally if user describes them | Defer to v2; keep v1 as pure capture + send. Claude's vision handles un-annotated screenshots well for most questions |
| Cloud upload / shareable link | Looks useful for sharing with teammates | Contradicts the "stays local" privacy contract; adds auth complexity, network dependency, and storage costs; not needed for Claude integration | Cloud sharing is a separate product category; keep local-only |
| Video / screen recording | "While you're at it" request | Completely different architecture (streaming buffers, encoding pipeline, codec selection); doubles the project scope | Explicitly out of scope for v1; document this to set expectations |
| OCR / text extraction | Users want to pull text from screenshots | Claude already performs OCR natively on images sent via the Read tool; building a parallel OCR pipeline duplicates capability that already exists | Just send the image; let Claude read the text |
| Persistent screenshot history / gallery | "Keep all my screenshots" feature | Breaks the ephemeral contract; creates privacy risk if screenshots accumulate; storage management complexity; not aligned with the tool's purpose | 24-hour temp-dir cleanup is the right default; no gallery |
| Multi-screenshot / batch capture | Power users want to capture multiple regions and send them together | Complicates the approval flow, the injection mechanism, and the hooks response format; multi-image support in Claude Code is possible but adds edge cases | Single-capture focus for v1; if multi-image is needed, user can invoke `/snapview` multiple times |
| Screenshot scheduling / automation | "Take a screenshot every N minutes" | Unrelated use case; turns a capture tool into a monitoring tool; out of scope | Not this tool's domain |

---

## Feature Dependencies

```
[Global shortcut trigger]
    └──requires──> [Electron globalShortcut registration]
                       └──requires──> [Electron app running (pre-warmed or on-demand)]

[Region capture overlay]
    └──requires──> [Transparent Electron window]
    └──requires──> [desktopCapturer API]
    └──requires──> [Screen permissions (macOS)]

[Capture preview]
    └──requires──> [Region capture overlay]
                       └──requires──> [Captured image in memory]

[Approve → inject into Claude]
    └──requires──> [Capture preview]
    └──requires──> [Temp file write]
    └──requires──> [Claude Code Read tool path]

[Auto-trigger via Claude hooks]
    └──requires──> [Claude Code hooks integration installed]
    └──enhances──> [Region capture overlay]

[/snapview skill command]
    └──requires──> [CLI binary on PATH]
    └──enhances──> [Manual trigger flow]

[Window-snap selection assist]
    └──enhances──> [Region capture overlay]

[Pixel magnifier during selection]
    └──enhances──> [Region capture overlay]

[Self-cleaning ephemeral storage]
    └──requires──> [Temp file write]

[Clipboard copy]
    └──requires──> [Captured image in memory]
    └──enhances──> [Capture preview] (available as action alongside inject)
```

### Dependency Notes

- **Region capture overlay requires screen permissions on macOS:** `desktopCapturer` triggers the macOS Screen Recording permission prompt. Must be handled at first-run with a clear user prompt — silent failure here is a critical pitfall.
- **Claude injection requires temp file write:** The injection mechanism is temp file + absolute path passed to Claude. The file must exist before Claude's Read tool is called. Race conditions are possible if the file write is async and the path is passed immediately.
- **Auto-trigger enhances region capture overlay:** The hooks-based auto-trigger launches the same capture UI as the manual `/snapview` trigger. Same code path, different initiator. This keeps the implementation surface small.
- **Pre-warmed Electron conflicts with on-demand launch:** If the Electron app pre-warms (hidden window on system start), it conflicts with "no background process unless active" user expectations. On-demand launch is cleaner but slower. This is a design tension to resolve explicitly.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] Region capture overlay with drag-to-select — this IS the core product
- [ ] Capture preview with approve/retake buttons — required for trust; users won't use a tool that sends wrong captures
- [ ] Temp file write + path injection into Claude Code — the entire value proposition depends on this
- [ ] `/snapview` skill command (manual trigger) — entry point for users; hooks integration can come after
- [ ] Auto-cleanup of temp files (24-hour max, on startup) — ships with ephemeral promise intact
- [ ] Cross-platform operation (Windows, macOS, Linux) — non-negotiable given Claude Code user base
- [ ] `npm i -g` / `bun add -g` install with `npx snapview install` — must be this simple; friction kills adoption

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] Auto-trigger via Claude hooks — trigger: if users consistently type `/snapview` in response to Claude asking "can you show me?", hooks automation is the obvious next step
- [ ] Global shortcut (configurable hotkey) — trigger: user feedback requesting faster access without terminal focus
- [ ] Window-snap selection assist — trigger: user feedback that drag-select is imprecise for common whole-window captures
- [ ] Pixel magnifier during selection — trigger: user feedback from developers doing precise UI debugging

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Annotation tools (arrows, boxes, text) — explicitly out of scope for v1; add if users frequently ask Claude to "look at the red box I drew"
- [ ] Configurable output format (PNG/JPEG) — defer; PNG is fine for all current use cases; add only when file size becomes a complaint
- [ ] Capture history (session-scoped) — defer; adds UI surface that isn't needed to validate the core loop

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Region capture overlay | HIGH | MEDIUM | P1 |
| Capture preview + approve/retake | HIGH | MEDIUM | P1 |
| Temp file write + Claude injection | HIGH | LOW | P1 |
| `/snapview` skill command | HIGH | LOW | P1 |
| Cross-platform operation | HIGH | HIGH | P1 |
| Auto-cleanup ephemeral storage | MEDIUM | LOW | P1 |
| Simple install (`npm i -g`) | HIGH | LOW | P1 |
| Auto-trigger via Claude hooks | HIGH | HIGH | P2 |
| Global hotkey | MEDIUM | MEDIUM | P2 |
| Window-snap selection assist | MEDIUM | MEDIUM | P2 |
| Pixel magnifier | MEDIUM | MEDIUM | P2 |
| Clipboard copy | LOW | LOW | P2 |
| Configurable format (PNG/JPEG) | LOW | LOW | P3 |
| Capture history (session) | LOW | MEDIUM | P3 |
| Annotation tools | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | CleanShot X (Mac) | ShareX (Windows) | Hammerspoon+screencapture (Mac/CLI DIY) | Snapview (our approach) |
|---------|-------------------|------------------|----------------------------------------|------------------------|
| Region capture | Yes, drag-select + magnifier | Yes, multiple modes | Yes, via screencapture -i | Yes, drag-select overlay |
| Preview before send | Yes, Quick Access Overlay | Optional post-capture | No — goes to clipboard | Yes, required step |
| AI integration | No native integration | No native integration | Manual paste into terminal | Direct Claude injection |
| Auto-trigger by AI | No | No | No | Yes (hooks) |
| CLI / terminal native | No (GUI app) | No (GUI app) | Partial (hotkey based) | Yes (npm install, CLI) |
| Cross-platform | Mac only | Windows only | Mac only | All three |
| Ephemeral storage | No (has capture history) | No (saves to folder) | No (clipboard) | Yes (24hr auto-clean) |
| Install simplicity | Mac App Store / Setapp | Download installer | Manual Hammerspoon config | `npm i -g snapview` |
| Annotation | Yes, extensive | Yes, extensive | No | Not in v1 |

**Takeaway:** No existing tool combines cross-platform CLI installation, AI session injection, and hooks-based auto-trigger. The Hammerspoon approach solves the paste-to-terminal problem on Mac but requires significant DIY setup, is Mac-only, and has no auto-trigger capability. Snapview's differentiation is real and uncontested.

---

## Sources

- [CleanShot X — All Features](https://cleanshot.com/features) — HIGH confidence, official product page
- [ShareX — Changelog and feature set](https://getsharex.com/changelog) — HIGH confidence, official source
- [quobix.com: Automating screenshots with Claude Code](https://quobix.com/articles/screenshots-with-claude-code/) — MEDIUM confidence; describes the exact user problem Snapview solves, using Hammerspoon as a DIY fix
- [Microsoft Copilot Snipping Tool announcement (March 2026)](https://www.ghacks.net/2026/03/06/microsoft-is-building-a-screenshot-tool-for-copilot-to-make-ai-help-more-accurate/) — MEDIUM confidence; validates the market direction of screenshot-to-AI tools
- [Shottr — pixel-professional features](https://shottr.cc/) — MEDIUM confidence; reference for magnifier UX patterns
- [ShareX Review: feature breakdown](https://elearningsupporter.com/2025/02/09/sharex-review-unleashing-the-screenshot-superpower-is-this-free-tool-your-ultimate-productivity-booster-deep-dive-alternatives/) — MEDIUM confidence; secondary analysis
- [Movavi: 17 Best Screenshot Tools for Windows 2025](https://www.movavi.com/learning-portal/best-screenshot-tools-windows.html) — LOW confidence; listicle but useful for feature pattern confirmation

---

*Feature research for: screenshot capture tool with AI CLI assistant integration (Snapview)*
*Researched: 2026-03-16*
