# Requirements: Snapview

**Defined:** 2026-03-16
**Core Value:** Users can share any part of their screen with Claude in under 3 seconds, without leaving the terminal workflow.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Capture

- [x] **CAPT-01**: User can trigger a fullscreen dimmed overlay for screen region selection
- [x] **CAPT-02**: User can drag-to-select a rectangular screen region with crosshair cursor
- [x] **CAPT-03**: User sees a preview of the captured region with "Send to Claude" and "Retake" options
- [x] **CAPT-04**: User can press ESC at any point to cancel capture and return to Claude
- [x] **CAPT-05**: Captured image is saved as PNG to OS temp directory with unique filename

### Claude Code Integration

- [x] **INTG-01**: User can type `/snapview` in Claude Code to launch the capture UI
- [x] **INTG-02**: Claude can auto-trigger the capture UI when it needs to see something
- [x] **INTG-03**: Global install automatically registers skill and hooks in `~/.claude/` (available in all projects)
- [x] **INTG-04**: Captured screenshot path is injected into Claude's context via stdout + Read tool
- [x] **INTG-05**: Claude can offer to promote an important screenshot to the project directory for long-term reference

### File Management

- [x] **FILE-01**: Screenshots are written to `os.tmpdir()/snapview/` with timestamp+random filenames
- [x] **FILE-02**: Screenshots older than 24 hours are automatically cleaned up on next launch
- [x] **FILE-03**: Screenshot is also copied to clipboard when captured

### Installation

- [x] **INST-01**: `npm i -g snapview` / `bun add -g snapview` installs AND configures Claude Code integration in one step
- [x] **INST-02**: All dependencies (Electron) are bundled — no external tools required
- [x] **INST-03**: Works on Windows, macOS, and Linux out of the box

### Platform Safety

- [x] **PLAT-01**: macOS screen recording permission is checked before capture attempt (no silent hang)
- [x] **PLAT-02**: Linux overlay uses correct GPU flags for transparency on X11/NVIDIA
- [x] **PLAT-03**: Electron process has hard-exit timeout to prevent Claude Code hook hang
- [x] **PLAT-04**: Overlay appears on the correct monitor in multi-monitor setups
- [x] **PLAT-05**: macOS Sequoia monthly permission re-prompt is handled gracefully
- [x] **PLAT-06**: Basic Wayland fallback support (X11 primary)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Capture Enhancements

- **CAPT-06**: Window-snap selection assist (highlight window boundaries on hover)
- **CAPT-07**: Pixel-level magnifier during drag selection
- **CAPT-08**: Global hotkey to trigger capture without terminal focus

### Annotation

- **ANNO-01**: Draw arrows on captured screenshot before sending
- **ANNO-02**: Draw rectangles/highlights on captured screenshot
- **ANNO-03**: Add text labels to captured screenshot

### Session Features

- **SESS-01**: Session-scoped capture history (view recent captures)
- **SESS-02**: Multi-screenshot batch capture and inject

## Out of Scope

| Feature | Reason |
|---------|--------|
| Video/screen recording | Capture only — different product entirely |
| Cloud storage or sharing | Images stay local; ephemeral by design |
| OCR/text extraction | Claude handles this natively from screenshots |
| Configurable image format | PNG is lossless and works perfectly with Claude's vision — no need for options |
| Mobile/tablet support | Desktop CLI tool only |
| `npx snapview` zero-install | Electron binary too large for on-demand npx; global install is the right pattern |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CAPT-01 | Phase 1 | Complete |
| CAPT-02 | Phase 1 | Complete |
| CAPT-03 | Phase 1 | Complete |
| CAPT-04 | Phase 1 | Complete |
| CAPT-05 | Phase 1 | Complete |
| INTG-01 | Phase 2 | Complete |
| INTG-02 | Phase 2 | Complete |
| INTG-03 | Phase 2 | Complete |
| INTG-04 | Phase 2 | Complete |
| INTG-05 | Phase 3 | Complete |
| FILE-01 | Phase 1 | Complete |
| FILE-02 | Phase 3 | Complete |
| FILE-03 | Phase 3 | Complete |
| INST-01 | Phase 2 | Complete |
| INST-02 | Phase 1 | Complete |
| INST-03 | Phase 1 | Complete |
| PLAT-01 | Phase 1 | Complete |
| PLAT-02 | Phase 1 | Complete |
| PLAT-03 | Phase 1 | Complete |
| PLAT-04 | Phase 1 | Complete |
| PLAT-05 | Phase 1 | Complete |
| PLAT-06 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

---
*Requirements defined: 2026-03-16*
*Last updated: 2026-03-16 after roadmap creation*
