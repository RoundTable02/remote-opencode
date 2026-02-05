# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-02-05

### Added
- **Automated Message Queuing**: Added a new system to queue multiple prompts in a thread. If the bot is busy, new messages are automatically queued and processed sequentially.
- **Fresh Context Mode**: Each queued job can optionally start with a fresh AI conversation context (new session) while maintaining the same code state.
- **Queue Management**: New `/queue` slash command suite to list, clear, pause, resume, and configure queue settings.
- **Queue Settings**:
  - `continue_on_failure`: Toggle whether the queue stops or continues when a job encounters an error.
  - `fresh_context`: Toggle between persistent conversation memory and fresh starts per job.
- **Visual Feedback**: The bot now reacts with `📥` when a message is successfully queued via chat.

### Changed
- **Refactored Execution Logic**: Moved core prompt execution to a dedicated `executionService` for better reliability and code reuse.

## [1.0.11] - 2026-02-04

### Added
- Model confirmation in Discord messages: The bot now displays which model is being used when starting a session.
- Real-time logging: Added always-on logging for `opencode serve` startup commands, working directories, and process output (stdout/stderr) for easier debugging.

### Fixed
- Fixed `opencode serve` startup failures: The bot now correctly detects when the server fails to start immediately and reports the actual error message to Discord instead of timing out after 30 seconds.
- Resolved `--model` flag error: Moved model selection from the `opencode serve` command (where it was unsupported) to the prompt API.
- Fixed Model API format: Correctly formatted model identifiers as objects (`{ providerID, modelID }`) as required by the OpenCode API.
- Improved Port Management: Fixed port availability checks to bind to `0.0.0.0` (matching the server) and added checks for orphaned servers to prevent "Address already in use" errors.
- Fixed button handlers (Interrupt, Create PR) to correctly respect channel model preferences.
- Fixed instance key logic to include the model, allowing multiple models to be used for the same project in different channels.

## [1.0.10] - 2026-02-04

### Added
- New `/setports` slash command to configure the port range for OpenCode server instances.

### Fixed
- Fixed Windows-specific spawning issue where the bot failed to find the `opencode` command (now targeting `opencode.cmd`).
- Resolved `spawn EINVAL` errors on Windows by correctly configuring shell execution.
- Fixed a crash where the bot would attempt to pass an unsupported `--model` flag to `opencode serve`.
- Improved server reliability by extending the ready-check timeout to 30 seconds.
- Suppressed `DEP0190` security warnings in the terminal caused by Windows-specific shell execution requirements.
- Standardized internal communication to use `127.0.0.1` and added real-time process logging (available via `DEBUG` env var).

## [1.0.9] - 2026-02-04

### Added
- New `/model` slash command to list and set AI models per channel.
- Support for `--model` flag in OpenCode server instances.
- Persistent storage for channel-specific model preferences.

### Fixed
- Fixed a connection timeout issue where the bot failed to connect to the internal `opencode serve` process.
- Added `--hostname 0.0.0.0` to the `opencode serve` command to ensure the service is reachable.
- Standardized internal communication to use `127.0.0.1` instead of `localhost` to avoid IPv6 resolution conflicts on some systems.
- Improved process exit handling in `serveManager` to ensure cleaner state management.
- Fixed `DiscordAPIError[40060]` (Interaction already acknowledged) by adding safety checks and better error handling in `interactionHandler.ts`.
- Resolved a `TypeError` in `opencode.ts` by adding safety checks for stream message updates.
- Updated all interaction responses to use `MessageFlags.Ephemeral` instead of the deprecated `ephemeral` property to resolve terminal warnings.
