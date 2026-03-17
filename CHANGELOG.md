# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.0]: https://github.com/Grips001/snapview/releases/tag/v1.0.0
