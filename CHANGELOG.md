# Changelog

All notable changes to this project will be documented in this file.

## [1.2.1] - 2026-02-05

### Added

- **Guided Onboarding**: Added an interactive prompt that automatically offers to run the setup wizard if the bot is launched without any configuration.
- **Improved Windows Experience**: Enhanced the standalone EXE behavior to prevent the terminal window from closing immediately after showing help text.

### Changed

- **CLI Robustness**: Consolidated default actions in the CLI to improve first-time user experience.

## [1.2.0] - 2026-02-05

### Added

- **Standalone Executable**: Added support for building a single, standalone `.exe` (for Windows) or binary (for Linux/macOS) using Node.js SEA (Single Executable Applications). Users can now run the bot without having Node.js installed.
- **New `/diff` Command**: Added a slash command to view current git changes in the project or active worktree directly from Discord. Supports optional `--staged` flag.
- **Build System**: Added `scripts/build-sea.js` to automate the process of bundling, SEA blob generation, and binary injection.
- **Node 24 Support**: Verified compatibility and optimized the codebase for Node.js 24.

### Changed

- **Modernized Dependencies**: Upgraded `discord.js` to `v14.25.1`, `commander` to `v14.0.3`, and `open` to `v11.0.0`.
- **Improved SEA Compatibility**: Added runtime shims for `import.meta.url` and `require` to support modern ESM packages in a bundled environment.
- **Noise Reduction**: Implemented custom warning suppression to silence Node.js SEA-specific native warnings on startup.

### Fixed

- **Security Hardening**: Fixed a moderate security vulnerability in `undici` (resource exhaustion) by forcing version `^6.23.0` via dependency overrides.
- **Cleaned Dependencies**: Removed unused `node-pty` dependency to simplify the build process and reduce binary size.

## [1.1.1] - 2026-02-05

...
