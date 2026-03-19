# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.5] - 2026-03-19

### Changed

- Upgraded Electron from 35.7.5 to 41.0.3
- Upgraded @types/node from ^22.0.0 to ^25.5.0
- Updated GitHub Actions to v6 (actions/checkout, actions/setup-node) for Node.js 24 compatibility
- CI and publish workflows now use Node.js 24 LTS

## [1.0.4] - 2026-03-19

### Improved

- Clarified multi-monitor support in README — overlay opens on whichever display the cursor is on
- Added demo GIF placeholder to README landing page
- Added security note about temporary screenshot files in shared environments

## [1.0.0] - 2026-03-17

### Added

- Screen capture overlay with drag-to-select region selection
- Preview panel with approve/retake flow
- Claude Code `/snapview` skill for one-command capture
- Auto-trigger Stop hook — Claude can request captures automatically
- Automatic postinstall setup of skill, hook, and settings
- `snapview install` / `snapview uninstall` subcommands
- HiDPI/Retina display support with proper scaling
- Multi-monitor support (overlay appears on active monitor)
- macOS Screen Recording permission detection and guidance
- Linux X11 transparent overlay with GPU compositing workarounds
- 24-hour automatic temp file cleanup (configurable via `SNAPVIEW_RETENTION_HOURS`)
- Screenshot promotion — Claude offers to save important captures to `./screenshots/`

[1.0.5]: https://github.com/Grips001/snapview/releases/tag/v1.0.5
[1.0.4]: https://github.com/Grips001/snapview/releases/tag/v1.0.4
[1.0.0]: https://github.com/Grips001/snapview/releases/tag/v1.0.0
