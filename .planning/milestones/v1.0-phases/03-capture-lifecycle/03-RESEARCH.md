# Phase 3: Capture Lifecycle - Research

**Researched:** 2026-03-17
**Domain:** Electron main-process APIs (clipboard, nativeImage), HTML5 Canvas HiDPI rendering, env-var configuration, SKILL.md instruction authoring
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Existing `sweepOldCaptures()` runs on app launch — Claude's discretion on whether to also run at session end
- Retention window configurable via `SNAPVIEW_RETENTION_HOURS` environment variable (default: 24)
- Existing 24h hardcoded constant in `src/main/cleanup.ts` must be replaced with env var lookup
- Auto-copy to clipboard on every approved capture — no opt-in, no user prompt
- Copy format: PNG image data (not file path) — user can Ctrl+V into Slack, docs, design tools
- Clipboard write happens alongside temp file save, before stdout output
- Electron's `clipboard.writeImage(nativeImage)` is the mechanism (already available in main process)
- Target directory: `./screenshots/` in the project root
- Claude uses judgment to offer promotion for "important" screenshots; stays quiet for quick troubleshooting
- User can always override — "save that screenshot" promotes regardless of Claude's assessment
- Naming: Claude generates a descriptive name based on screenshot content
- Promotion is handled by Claude via SKILL.md instructions — not a binary change
- Fix the overlay background rendering to account for devicePixelRatio on Retina/HiDPI displays
- The actual capture output is already correct — this is an overlay visual quality fix only
- Affects `src/renderer/app.ts` where the thumbnail is drawn onto the canvas

### Claude's Discretion
- Whether cleanup also runs on session end (in addition to launch)
- Git tracking for promoted screenshots (`.gitignore` or tracked by default)
- Exact implementation of the HiDPI canvas compensation
- Clipboard error handling (if clipboard write fails, capture should still succeed)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FILE-02 | Screenshots older than 24 hours are automatically cleaned up on next launch | Env-var lookup pattern, existing `sweepOldCaptures()` already works — just needs constant replaced |
| FILE-03 | Screenshot is also copied to clipboard when captured | `clipboard.writeImage(nativeImage)` in main process, `cropped` nativeImage already available in `captureRegion()` |
| INTG-05 | Claude can offer to promote an important screenshot to the project directory for long-term reference | SKILL.md instruction addition — fs copy via Bash tool; no binary changes |
</phase_requirements>

---

## Summary

Phase 3 completes the Snapview v1 capture lifecycle with four targeted changes: env-var-configurable cleanup retention, automatic clipboard copy on approval, SKILL.md promotion instructions for Claude, and a HiDPI rendering fix for the overlay canvas.

All four changes are surgical modifications to existing files. No new modules are needed. The Electron `clipboard` module is already available in the main process and works via `clipboard.writeImage(nativeImage)` — and the `cropped` nativeImage in `captureRegion()` is already the right object to pass. The HiDPI bug is a source-coordinate error in `drawSelection()`: the comment incorrectly claims screenImage is at native resolution, but it is actually at CSS pixel resolution (thumbnailSize was set to display.size CSS values), so the `x * dpr` multiplication overshoots the source image.

**Primary recommendation:** Make all four changes as isolated edits to their respective files. Keep clipboard failure non-fatal (try/catch, log warning, never block the capture path). The HiDPI fix removes the `* dpr` multiplier from the drawImage source coords in `drawSelection()`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `electron` (clipboard module) | 35.7.5 (pinned) | Write PNG image data to system clipboard | Built-in to Electron; no extra dependency |
| `electron` (nativeImage module) | 35.7.5 (pinned) | Image type passed to clipboard.writeImage | Already used in capture.ts; `cropped` object is the right handle |
| Node `process.env` | built-in | Read `SNAPVIEW_RETENTION_HOURS` at runtime | Standard env-var pattern; no library needed |
| `fs.copyFile` / `fs.cp` | built-in | Promote screenshot to `./screenshots/` | Already imported in capture.ts via `fs/promises` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `bun:test` + `mock.module` | 1.3.10 | Unit tests for modified cleanup.ts | Test env-var branch; mock `process.env` inline |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `clipboard.writeImage(nativeImage)` | Spawn `xclip`/`pbcopy` shell commands | Shell approach is fragile, platform-divergent, adds latency; Electron API is the right choice |
| Env-var at module load | Env-var read inside `sweepOldCaptures()` | Module-load cache prevents test isolation; read inside the function is more testable |

**No new packages to install.** All required APIs are already in the dependency tree.

---

## Architecture Patterns

### Recommended Project Structure
No structural changes. All edits are in-place within existing files:
```
src/
├── main/
│   ├── cleanup.ts       # Replace hardcoded constant with env-var lookup
│   ├── capture.ts       # Add clipboard.writeImage() after cropped.toPNG()
│   └── index.ts         # No changes needed (clipboard write is inside captureRegion)
└── renderer/
    └── app.ts           # Fix drawSelection() source coords (remove * dpr)
claude-integration/
└── SKILL.md             # Add screenshot promotion instructions
```

### Pattern 1: Env-var with Fallback for Retention Hours

**What:** Read `SNAPVIEW_RETENTION_HOURS` inside `sweepOldCaptures()`, parse as float, fall back to 24 on invalid/absent values.

**When to use:** Any configurable constant in Electron main process. Read inside the function (not at module level) so tests can override via `process.env` without module re-import.

**Example:**
```typescript
// In sweepOldCaptures() — replaces the module-level constant
const retentionHours = parseFloat(process.env.SNAPVIEW_RETENTION_HOURS ?? '') || 24;
const retentionMs = retentionHours * 60 * 60 * 1000;
// Use retentionMs in place of TWENTY_FOUR_HOURS_MS
```

The `parseFloat('') || 24` pattern handles empty string, `NaN`, and `0` all correctly by falling back to 24.

### Pattern 2: Non-Fatal Clipboard Write

**What:** Wrap `clipboard.writeImage()` in try/catch, log the error, never rethrow. The capture itself must always succeed regardless of clipboard state.

**When to use:** Any best-effort side effect that should not block the primary happy path.

**Example:**
```typescript
// In captureRegion() — after cropping, before writing PNG to disk
import { clipboard } from 'electron';

// ... cropped = fullImage.crop(physicalRect)
try {
  clipboard.writeImage(cropped);
} catch (err) {
  console.error('[snapview] clipboard.writeImage failed:', (err as Error).message);
  // Non-fatal — capture continues
}

const pngBuffer = cropped.toPNG();
// ... write to file
```

**Confidence:** HIGH — verified via official Electron docs. `clipboard.writeImage(nativeImage)` accepts a NativeImage object. The `cropped` variable in `captureRegion()` is already a NativeImage. The import just needs to be added to `capture.ts`.

### Pattern 3: HiDPI Canvas Source Coordinate Fix

**What:** The bug is in `drawSelection()` line 104. The source image (`screenImage`) was loaded from `getScreenSources()` where `thumbnailSize` was set to `activeDisplay.size` — which returns CSS pixel dimensions. So the image natural width/height is in CSS pixels, not physical pixels. The current code multiplies source coordinates by `dpr`, which is wrong.

**Root cause:** The comment "Source coords must be in physical pixels (screenImage is at native resolution)" is incorrect. The thumbnail IS at CSS pixel resolution. Only the canvas backing buffer is in physical pixels (scaled by dpr via `ctx.scale(dpr, dpr)`).

**The fix:** Remove `* dpr` from the source rect in `drawSelection()`:

```typescript
// BEFORE (buggy — overshoots source image on HiDPI)
ctx.drawImage(screenImage, x * dpr, y * dpr, width * dpr, height * dpr, x, y, width, height);

// AFTER (correct — source coords match CSS pixel image dimensions)
ctx.drawImage(screenImage, x, y, width, height, x, y, width, height);
```

Because `ctx.scale(dpr, dpr)` is already applied, the destination coords `x, y, width, height` in CSS pixels are automatically rendered at the correct physical pixel positions. The source coords just need to slice the CSS-resolution image correctly.

**Confidence:** HIGH — derived directly from reading the existing code and the desktopCapturer API docs confirming thumbnailSize is in CSS pixels.

**Also verify `drawDimOverlay()`:** Line 74 draws `ctx.drawImage(screenImage, 0, 0, w, h)` where `w = canvas.width / dpr` (CSS pixels). This is already correct — drawing the CSS-resolution image to CSS-pixel destination. No change needed there.

**Also verify `transitionToPreviewing()`:** Lines 130-134 use `x * dpr, y * dpr` as source coords and `width * dpr, height * dpr` as source sizes. Same bug pattern — these should not multiply by dpr since screenImage is CSS resolution. Fix the same way.

### Pattern 4: SKILL.md Promotion Instructions

**What:** Append a "Screenshot Promotion" section to `claude-integration/SKILL.md` describing when to offer promotion and the exact Bash command to copy the file.

**When to use:** Claude-only behavior changes with no binary modification needed.

**Example SKILL.md addition:**
```markdown
## Screenshot Promotion (INTG-05)

After sending a screenshot to Claude's context, evaluate whether it's worth keeping long-term:

**Offer promotion for:** design references, bug evidence, architecture diagrams, UI state that matters beyond this session.
**Stay quiet for:** quick debug checks, error messages you'll forget, temporary troubleshooting.

The user can always override: "save that screenshot" or "keep that" means promote regardless of your assessment.

When promoting:
1. Generate a descriptive filename from the content (e.g., `login-page-layout.png`, `api-error-response.png`, `cart-checkout-bug.png`)
2. Run: `mkdir -p ./screenshots && cp {temp_file_path} ./screenshots/{descriptive-name}.png`
3. Confirm: "Saved as `./screenshots/{descriptive-name}.png`"
```

### Anti-Patterns to Avoid

- **Throwing from clipboard write:** If `clipboard.writeImage()` throws, the entire `captureRegion()` would fail and produce exit code 1 — user sees "Screenshot failed" when the only problem was a clipboard permission. Always wrap in try/catch.
- **Reading env-var at module load:** `const RETENTION_MS = parseFloat(process.env.SNAPVIEW_RETENTION_HOURS) * ...` at top of cleanup.ts makes the value baked in at import time. Tests cannot override it without module re-registration trickery. Read inside the function.
- **Multiplying by dpr in drawImage source coords when image is CSS resolution:** The existing bug — don't repeat it in any new canvas draw calls.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Clipboard image write | Custom binary format packing | `clipboard.writeImage(nativeImage)` | Handles platform clipboard format negotiation (DIBitmap on Windows, NSImage on macOS, X11 selection on Linux) |
| Env-var parsing | Custom config file reader | `process.env` + `parseFloat` + fallback | Zero deps, readable, standard Node idiom |
| File copy for promotion | Manual read+write stream | `fs.copyFile(src, dest)` | Atomic on most platforms, handles large files, preserves permissions |

**Key insight:** The entire phase is wiring existing primitives together. The hard work (nativeImage creation, file writing, cleanup logic) is already done.

---

## Common Pitfalls

### Pitfall 1: Clipboard write blocks capture on failure

**What goes wrong:** `clipboard.writeImage()` throws on Linux if `xclip` or `xsel` is unavailable (headless servers, CI environments), or on macOS/Windows if accessibility permissions are revoked mid-session. Without try/catch, the IPC handler throws, exits with code 1, and Claude sees "Screenshot failed."

**Why it happens:** clipboard module throws synchronously on some Linux configurations if the X11 display clipboard service is unavailable.

**How to avoid:** Always wrap `clipboard.writeImage()` in try/catch. Log the error with `[snapview]` prefix. Continue capture execution.

**Warning signs:** Exit code 1 on Linux CI or in SSH sessions without display forwarding.

### Pitfall 2: Env-var read at module scope breaks tests

**What goes wrong:** `const RETENTION_MS = parseFloat(process.env.SNAPVIEW_RETENTION_HOURS || '24') * 3600000` at module level in `cleanup.ts`. Tests that set `process.env.SNAPVIEW_RETENTION_HOURS = '1'` before importing will still get the baked-in value unless the module is re-imported.

**Why it happens:** Node/Bun module cache; `import { sweepOldCaptures }` at top of test file runs before test-level env-var override.

**How to avoid:** Read `process.env.SNAPVIEW_RETENTION_HOURS` inside `sweepOldCaptures()` body, not at module level. Tests can then set env before calling the function.

**Warning signs:** Test that sets `process.env.SNAPVIEW_RETENTION_HOURS = '0'` still deletes files older than 24h.

### Pitfall 3: HiDPI fix breaks the selection cutout

**What goes wrong:** Removing `* dpr` from source coords in `drawSelection()` without checking whether `transitionToPreviewing()` has the same pattern. The preview crop also uses `x * dpr` as source coords. If left uncorrected there, the preview panel will show the wrong (still zoomed) region.

**Why it happens:** The bug was written consistently throughout the file based on the wrong assumption. A partial fix creates inconsistency.

**How to avoid:** Fix all occurrences — `drawSelection()` line 104 AND `transitionToPreviewing()` lines 130-134.

### Pitfall 4: `fs.copyFile` destination directory must exist

**What goes wrong:** Claude runs `cp temp_path ./screenshots/desc-name.png` but the `./screenshots/` directory doesn't exist in the project. The copy fails silently or with a confusing error.

**Why it happens:** Claude's Bash tool executes relative to the project root, but `./screenshots/` is not created automatically.

**How to avoid:** SKILL.md instructions must include `mkdir -p ./screenshots` before the copy command. The combined command is `mkdir -p ./screenshots && cp {path} ./screenshots/{name}.png`.

### Pitfall 5: clipboard.writeImage always writes PNG (feature, not bug)

**What goes wrong:** Confusion if someone expects `clipboard.writeImage()` to write JPEG or another format. It always writes PNG regardless of the source image format.

**Why it happens:** Electron's clipboard implementation always encodes as PNG on write (confirmed by electron/electron#14601).

**How to avoid:** No action needed — PNG is the desired format. Just document it so future maintainers aren't confused.

---

## Code Examples

### Cleanup.ts — Env-var retention

```typescript
// Source: derived from existing cleanup.ts pattern + Node.js process.env docs
export async function sweepOldCaptures(): Promise<void> {
  const retentionHours = parseFloat(process.env.SNAPVIEW_RETENTION_HOURS ?? '') || 24;
  const retentionMs = retentionHours * 60 * 60 * 1000;
  const snapviewDir = path.join(os.tmpdir(), 'snapview');
  try {
    const entries = await fs.readdir(snapviewDir);
    const now = Date.now();
    for (const entry of entries) {
      if (!entry.startsWith('snapview-') || !entry.endsWith('.png')) continue;
      const fullPath = path.join(snapviewDir, entry);
      const stat = await fs.stat(fullPath);
      if (now - stat.mtimeMs > retentionMs) {
        await fs.unlink(fullPath).catch(() => {});
      }
    }
  } catch {
    // snapview dir doesn't exist yet — silently return
  }
}
```

### Capture.ts — Clipboard write

```typescript
// Source: Electron docs https://www.electronjs.org/docs/latest/api/clipboard
import { desktopCapturer, nativeImage, screen, systemPreferences, shell, clipboard } from 'electron';

// Inside captureRegion(), after: const cropped = fullImage.crop(physicalRect);
try {
  clipboard.writeImage(cropped);
} catch (err) {
  console.error('[snapview] clipboard.writeImage failed (non-fatal):', (err as Error).message);
}
const pngBuffer = cropped.toPNG();
```

### Renderer app.ts — HiDPI fix (drawSelection)

```typescript
// BEFORE
ctx.drawImage(screenImage, x * dpr, y * dpr, width * dpr, height * dpr, x, y, width, height);

// AFTER — source coords are in CSS pixels (matching image natural dimensions)
ctx.drawImage(screenImage, x, y, width, height, x, y, width, height);
```

### Renderer app.ts — HiDPI fix (transitionToPreviewing)

```typescript
// BEFORE
cropCtx.drawImage(screenImage!, x * dpr, y * dpr, width * dpr, height * dpr, 0, 0, width * dpr, height * dpr);

// AFTER — source at CSS pixels; dest at physical pixels for quality preview
cropCtx.drawImage(screenImage!, x, y, width, height, 0, 0, width * dpr, height * dpr);
```

### SKILL.md — Promotion section

```markdown
## Screenshot Promotion (INTG-05)

After a screenshot is sent to context, evaluate whether it deserves long-term storage.

**Offer promotion for:** design references, bug evidence, architecture diagrams, UI mockups,
error screenshots the user will need to share or revisit.
**Stay quiet for:** quick terminal checks, temporary debug output, throwaway troubleshooting.

User can always override with "save that" or "keep that screenshot" — always honor the request.

To promote:
1. Generate a descriptive filename from content: `login-page-layout.png`, `api-error-500.png`
2. Run via Bash: `mkdir -p ./screenshots && cp {temp_file_path} ./screenshots/{descriptive-name}.png`
3. Confirm to user: "Saved as `./screenshots/{descriptive-name}.png`"
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded 24h constant | `SNAPVIEW_RETENTION_HOURS` env-var | Phase 3 | Ops teams and power users can tune retention without recompiling |
| Capture-only output | Capture + clipboard write | Phase 3 | User can immediately Ctrl+V screenshot anywhere without extra steps |
| All screenshots ephemeral | Optional promotion to `./screenshots/` | Phase 3 | High-value screenshots survive temp cleanup |
| Overlay zoomed on HiDPI | Correct CSS-pixel source coords | Phase 3 | Overlay visually matches what was selected |

**Deprecated/outdated:**
- `TWENTY_FOUR_HOURS_MS` module-level constant in `cleanup.ts`: replaced by inline env-var lookup.

---

## Open Questions

1. **Should sweepOldCaptures() also run on `app.quit` / session end?**
   - What we know: Currently fire-and-forget on launch only; user left this to Claude's discretion
   - What's unclear: Whether session-end cleanup has meaningful benefit (temp files are ephemeral by design)
   - Recommendation: Add a `sweepOldCaptures()` call in the `window-all-closed` handler for belt-and-suspenders, but wrapped in a separate non-awaited promise so it cannot delay quit

2. **Git tracking for `./screenshots/`?**
   - What we know: `.gitignore` does not currently ignore `screenshots/`; no screenshots directory exists
   - What's unclear: Whether users want promoted screenshots tracked in git by default
   - Recommendation: Do NOT add `screenshots/` to `.gitignore` — promoted screenshots represent deliberate user intent and should be tracked. Add a note in SKILL.md that the user can gitignore if preferred.

3. **Clipboard behavior on Linux headless / no-display environments**
   - What we know: `clipboard.writeImage()` may throw when no X11 display is connected
   - What's unclear: Exact error message and whether it's synchronous or async
   - Recommendation: The non-fatal try/catch handles it. Log with `[snapview]` prefix. No further action.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | bun:test 1.3.10 |
| Config file | none — `bun test` auto-discovers `*.test.ts` |
| Quick run command | `bun test src/main/cleanup.test.ts` |
| Full suite command | `bun test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FILE-02 | `sweepOldCaptures()` uses `SNAPVIEW_RETENTION_HOURS` env-var | unit | `bun test src/main/cleanup.test.ts` | ✅ (needs new test cases) |
| FILE-02 | Default retention is 24h when env-var absent | unit | `bun test src/main/cleanup.test.ts` | ✅ (needs new test cases) |
| FILE-03 | `captureRegion()` calls `clipboard.writeImage(cropped)` | source-level | `bun test src/main/capture.test.ts` | ✅ (needs new source-verify test) |
| FILE-03 | Clipboard failure does not prevent file write | unit | `bun test src/main/capture.test.ts` | ❌ Wave 0 |
| INTG-05 | SKILL.md contains promotion instructions | source-level | `bun test` (new SKILL.md test) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `bun test src/main/cleanup.test.ts && bun test src/main/capture.test.ts`
- **Per wave merge:** `bun test`
- **Phase gate:** Full suite green (`bun test` — 72+ pass, 0 fail) before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] New test cases in `src/main/cleanup.test.ts` — covers FILE-02 env-var behavior (retention from env, default 24h fallback)
- [ ] New source-level test in `src/main/capture.test.ts` — covers FILE-03 (clipboard.writeImage import present, non-fatal pattern present)
- [ ] New test file `src/main/skill.test.ts` (or inline in capture.test.ts) — verifies SKILL.md contains promotion language (INTG-05)
- [ ] Clipboard failure resilience test in `src/main/capture.test.ts` — mock clipboard.writeImage to throw, assert file still written

Note: The HiDPI fix in `src/renderer/app.ts` is renderer-side canvas logic — no automated test is feasible without a real display. Manual validation on a HiDPI display (or by inspecting the source pattern change) is the appropriate approach.

---

## Sources

### Primary (HIGH confidence)
- [Electron clipboard API](https://www.electronjs.org/docs/latest/api/clipboard) — writeImage(), readImage(), platform notes, main process availability
- [Electron nativeImage API](https://www.electronjs.org/docs/latest/api/native-image) — createFromBuffer, createFromDataURL, scaleFactor support
- [Electron desktopCapturer API](https://www.electronjs.org/docs/latest/api/desktop-capturer) — thumbnailSize parameter, CSS pixel dimensions
- `src/main/capture.ts` (existing code) — verified nativeImage `cropped` object available pre-toPNG()
- `src/main/cleanup.ts` (existing code) — exact location of hardcoded constant to replace
- `src/renderer/app.ts` (existing code) — exact lines of drawImage bug (line 104, lines 130-134)

### Secondary (MEDIUM confidence)
- [electron/electron#14601](https://github.com/electron/electron/issues/14601) — confirms clipboard.writeImage always writes PNG regardless of format param (closed, Electron 2.x era; behavior consistent in later versions)
- [web.dev HiDPI Canvas](https://web.dev/articles/canvas-hidipi) — standard CSS pixel / dpr canvas pattern reference

### Tertiary (LOW confidence)
- [electron/electron#35565](https://github.com/electron/electron/issues/35565) — clipboard paste to file system (Windows Explorer) may not work; irrelevant — snapview's use case is Ctrl+V into apps not file manager drag-drop

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all APIs are built-in to Electron 35.7.5 which is already the pinned version
- Architecture: HIGH — all four changes are surgical edits to known files; patterns verified from existing code
- Pitfalls: HIGH — root causes derived directly from reading actual source code, not speculation
- HiDPI fix root cause: HIGH — confirmed by tracing thumbnailSize through getScreenSources() to ctx.drawImage source coords

**Research date:** 2026-03-17
**Valid until:** 2026-06-17 (stable APIs; Electron clipboard and canvas behavior changes rarely)
