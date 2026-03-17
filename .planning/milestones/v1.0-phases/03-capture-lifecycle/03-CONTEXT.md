# Phase 3: Capture Lifecycle - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the capture lifecycle with three features plus one polish fix: auto-cleanup of old screenshots with configurable retention, clipboard copy on every approved capture, screenshot promotion to the project directory for long-term reference, and HiDPI overlay rendering fix. This is the final phase of v1.

</domain>

<decisions>
## Implementation Decisions

### Cleanup behavior
- Existing `sweepOldCaptures()` runs on app launch — Claude's discretion on whether to also run at session end
- Retention window configurable via `SNAPVIEW_RETENTION_HOURS` environment variable (default: 24)
- Existing 24h hardcoded constant in `src/main/cleanup.ts` must be replaced with env var lookup

### Clipboard copy
- Auto-copy to clipboard on every approved capture — no opt-in, no user prompt
- Copy format: PNG image data (not file path) — user can Ctrl+V into Slack, docs, design tools
- Clipboard write happens alongside temp file save, before stdout output
- Electron's `clipboard.writeImage(nativeImage)` is the mechanism (already available in main process)

### Screenshot promotion
- Target directory: `./screenshots/` in the project root
- Claude uses judgment to offer promotion for "important" screenshots (design references, bug evidence, architecture diagrams) but stays quiet for quick troubleshooting captures
- User can always override — "save that screenshot" promotes regardless of Claude's assessment. User is always right.
- Naming: Claude generates a descriptive name based on screenshot content (e.g., `login-page-layout.png`, `api-error-response.png`)
- Promotion is handled by Claude via the SKILL.md instructions — Claude copies the temp file to `./screenshots/{descriptive-name}.png` using file system tools
- This is a SKILL.md instruction change, not a binary change — Claude already has access to the file path and can copy it

### HiDPI overlay fix
- Fix the overlay background rendering to account for devicePixelRatio on Retina/HiDPI displays
- Currently `desktopCapturer` thumbnail is drawn without compensation, causing a zoomed-in appearance on the overlay canvas
- The actual capture output is already correct (captureRegion applies scaleFactor) — this is an overlay visual quality fix only
- Affects `src/renderer/app.ts` where the thumbnail is drawn onto the canvas

### Claude's Discretion
- Whether cleanup also runs on session end (in addition to launch)
- Git tracking for promoted screenshots (`.gitignore` or tracked by default)
- Exact implementation of the HiDPI canvas compensation
- Clipboard error handling (if clipboard write fails, capture should still succeed)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — FILE-02 (auto-cleanup), FILE-03 (clipboard copy), INTG-05 (screenshot promotion)
- `.planning/ROADMAP.md` — Phase 3 success criteria and goal

### Existing implementation (modify these)
- `src/main/cleanup.ts` — `sweepOldCaptures()` with hardcoded 24h constant — needs env var support
- `src/main/capture.ts` — `captureRegion()` returns `CaptureResult` with `filePath` — clipboard write integrates here
- `src/main/index.ts` — IPC handler for `capture:region` — clipboard write after captureRegion() returns
- `src/renderer/app.ts` — Overlay canvas rendering — HiDPI fix goes here
- `claude-integration/SKILL.md` — Needs promotion instructions added for Claude

### Prior decisions (from STATE.md)
- HiDPI zoom artifact deferred from Phase 1 — desktopCapturer thumbnail without devicePixelRatio compensation
- Electron `clipboard` module available in main process
- `nativeImage` already used in capture.ts — can be passed to clipboard.writeImage()

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/main/cleanup.ts`: `sweepOldCaptures()` already implements the core cleanup logic — just needs env var for retention hours
- `src/main/capture.ts`: `captureRegion()` already creates the `nativeImage` and crops it — clipboard write can use the same `cropped` nativeImage before converting to PNG buffer
- `claude-integration/SKILL.md`: Already has the `/snapview` flow — promotion instructions add to the existing steps
- Electron `clipboard` module: Available in main process, supports `clipboard.writeImage(nativeImage)`

### Established Patterns
- Fire-and-forget for non-critical operations (cleanup pattern)
- IPC channels defined in `src/shared/types.ts`
- Exit codes: 0=success, 1=error, 2=cancelled
- Best-effort error handling for filesystem operations (cleanup ignores individual file errors)

### Integration Points
- `captureRegion()` in `capture.ts` — clipboard write integrates into the capture flow
- `sweepOldCaptures()` in `cleanup.ts` — env var lookup replaces hardcoded constant
- `src/renderer/app.ts` — canvas drawing logic for HiDPI fix
- `claude-integration/SKILL.md` — promotion instructions for Claude

</code_context>

<specifics>
## Specific Ideas

- Clipboard copy should feel automatic — user captures, image is on clipboard, no extra steps
- Promotion naming should be descriptive from content (Claude generates name) rather than timestamps
- Claude should be smart about when to offer promotion — design docs yes, quick debug screenshots no
- HiDPI fix is a quality-of-life improvement that rounds out the v1 experience

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-capture-lifecycle*
*Context gathered: 2026-03-17*
