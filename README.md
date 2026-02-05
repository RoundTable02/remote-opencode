# remote-opencode

> Control your AI coding assistant from anywhere — your phone, tablet, or another computer.

<div align="center">
<img width="1024" alt="Gemini_Generated_Image_47d5gq47d5gq47d5" src="https://github.com/user-attachments/assets/1defa11d-6195-4a9c-956b-4f87470f6393" />
</div>

**remote-opencode** is a Discord bot that bridges your local [OpenCode CLI](https://github.com/sst/opencode) to Discord, enabling you to interact with your AI coding assistant remotely. Perfect for developers who want to:

- 📱 **Code from mobile** — Send coding tasks from your phone while away from your desk
- 💻 **Access from any device** — Use your powerful dev machine from a laptop or tablet
- 🌍 **Work remotely** — Control your home/office workstation from anywhere
- 👥 **Collaborate** — Share AI coding sessions with team members in Discord
- 🤖 **Automated Workflows** — Queue up multiple tasks and let the bot process them sequentially

## How It Works

```
┌─────────────────┐    Discord API    ┌─────────────────┐
│  Your Phone /   │ ◄──────────────► │  Discord Bot    │
│  Other Device   │                   │  (this project) │
└─────────────────┘                   └────────┬────────┘
                                               │
                                               ▼
                                      ┌─────────────────┐
                                      │  OpenCode CLI   │
                                      │  (your machine) │
                                      └────────┬────────┘
                                               │
                                               ▼
                                      ┌─────────────────┐
                                      │  Your Codebase  │
                                      └─────────────────┘
```

The bot runs on your development machine alongside OpenCode. When you send a command via Discord, it's forwarded to OpenCode, and the output streams back to you in real-time.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Discord Bot Setup](#discord-bot-setup)
- [CLI Commands](#cli-commands)
- [Discord Slash Commands](#discord-slash-commands)
- [Usage Workflow](#usage-workflow)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Changelog](#changelog)
- [License](#license)

---

## Installation

### Prerequisites

- **OpenCode CLI** — Must be installed and working on your machine
- **Discord Account** — With a server where you have admin permissions

### Standalone Executable (Windows)

The easiest way to use **remote-opencode** is to download the standalone `.exe` from our [Releases](https://github.com/Dayclone/remote-opencode/releases) page.

- **No Node.js required** — Everything is bundled inside the binary
- **Portable** — Run it from any folder
- **Guided Setup** — Automatically helps you configure the bot on first run

### Install via npm

If you have **Node.js 22+** installed:

```bash
# Global installation (recommended)
npm install -g remote-opencode

# Or run directly with npx
npx remote-opencode
```

### Build from source

```bash
git clone https://github.com/Dayclone/remote-opencode.git
cd remote-opencode
npm install
npm run build
npm link  # Makes 'remote-opencode' available globally
```

### Create your own Standalone Executable

If you want to package your current source into a single `.exe`:

```bash
# Generates dist/remote-opencode.exe
npm run build:sea
```

---

## Quick Start

```bash
# Simply run the bot
remote-opencode
```

If it's your first time, the bot will automatically detect that it's unconfigured and offer to start the **Interactive Setup Wizard**.

---

## Discord Bot Setup

The setup wizard (`remote-opencode setup`) guides you through the entire process interactively:

1. **Opens Discord Developer Portal** in your browser
2. **Walks you through** creating an application, enabling intents, and getting your bot token
3. **Generates the invite link** automatically and opens it in your browser
4. **Deploys slash commands** to your server

Just follow the prompts — no manual URL copying needed!

<details>
<summary>📖 Manual setup reference (click to expand)</summary>

If you prefer manual setup or need to troubleshoot:

1. **Create Application**: Go to [Discord Developer Portal](https://discord.com/developers/applications), create a new application
2. **Enable Intents**: In "Bot" section, enable SERVER MEMBERS INTENT and MESSAGE CONTENT INTENT
3. **Get Bot Token**: In "Bot" section, reset/view token and copy it
4. **Get Guild ID**: Enable Developer Mode in Discord settings, right-click your server → Copy Server ID
5. **Invite Bot**: Use this URL format:
   ```
   https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=2147534848&scope=bot+applications.commands
   ```

</details>

---

## CLI Commands

| Command                  | Description                                     |
| ------------------------ | ----------------------------------------------- |
| `remote-opencode`        | Start the bot (triggers guided setup if needed) |
| `remote-opencode setup`  | Interactive setup wizard — configures bot token |
| `remote-opencode start`  | Start the Discord bot                           |
| `remote-opencode deploy` | Deploy/update slash commands to Discord         |
| `remote-opencode config` | Display current configuration info              |

---

## Discord Slash Commands

Once the bot is running, use these commands in your Discord server:

### `/diff` — View Current Changes

View the git diff of the current project or active worktree.

```
/diff
/diff staged:True
```

| Parameter | Description                                     |
| --------- | ----------------------------------------------- |
| `staged`  | Optional. If `True`, shows only staged changes. |

**Features:**

- 🌳 **Worktree Aware** — Automatically shows diffs for the specific worktree if used in a `/work` thread.
- 📝 **Formatted** — Uses syntax-highlighted code blocks.
- ✂️ **Smart Truncation** — Safely handles large diffs to stay within Discord's message limits.

### `/setpath` — Register a Project

Register a local project path with an alias for easy reference.

```
/setpath alias:myapp path:/Users/you/projects/my-app
```

| Parameter | Description                                           |
| --------- | ----------------------------------------------------- |
| `alias`   | Short name for the project (e.g., `myapp`, `backend`) |
| `path`    | Absolute path to the project on your machine          |

### `/projects` — List Registered Projects

View all registered project paths and their aliases.

```
/projects
```

### `/use` — Bind Project to Channel

Set which project a Discord channel should interact with.

```
/use alias:myapp
```

After binding, all `/opencode` commands in that channel will work on the specified project.

### `/opencode` — Send Command to AI

The main command — sends a prompt to OpenCode and streams the response.

```
/opencode prompt:Add a dark mode toggle to the settings page
```

**Features:**

- 🧵 **Auto-creates a thread** for each conversation
- ⚡ **Real-time streaming** — see output as it's generated (1-second updates)
- ⏸️ **Interrupt button** — stop the current task if needed
- 📝 **Session persistence** — continue conversations in the same thread

### `/work` — Create a Git Worktree

Start isolated work on a new branch with its own worktree.

```
/work branch:feature/dark-mode description:Implement dark mode toggle
```

| Parameter     | Description                         |
| ------------- | ----------------------------------- |
| `branch`      | Git branch name (will be sanitized) |
| `description` | Brief description of the work       |

**Features:**

- 🌳 Creates a new git worktree for isolated work
- 🧵 Opens a dedicated thread for the task
- 🗑️ **Delete button** — removes worktree and archives thread
- 🚀 **Create PR button** — automatically creates a pull request

This is perfect for working on multiple features simultaneously without branch switching.

### `/code` — Toggle Passthrough Mode

Enable passthrough mode in a thread to send messages directly to OpenCode without slash commands.

```
/code
```

**How it works:**

1. Run `/code` in any thread to enable passthrough mode
2. Type messages naturally — they're sent directly to OpenCode
3. Run `/code` again to disable

**Example:**

```
You: /code
Bot: ✅ Passthrough mode enabled for this thread.
     Your messages will be sent directly to OpenCode.

You: Add a dark mode toggle to settings
Bot: 📌 Prompt: Add a dark mode toggle to settings
     [streaming response...]

You: Now add a keyboard shortcut for it
Bot: 📌 Prompt: Now add a keyboard shortcut for it
     [streaming response...]

You: /code
Bot: ❌ Passthrough mode disabled.
```

**Features:**

- 📱 **Mobile-friendly** — no more typing slash commands on phone
- 🧵 **Thread-scoped** — only affects the specific thread, not the whole channel
- ⏳ **Busy indicator** — shows ⏳ reaction if previous task is still running
- 🔒 **Safe** — ignores bot messages (no infinite loops)

### `/autowork` — Toggle Automatic Worktree Creation

Enable automatic worktree creation for a project. When enabled, new `/opencode` sessions will automatically create isolated git worktrees.

```
/autowork
```

**How it works:**

1. Run `/autowork` in a channel bound to a project
2. The setting toggles on/off for that project
3. When enabled, new sessions automatically create worktrees with branch names like `auto/abc12345-1738600000000`

**Features:**

- 🌳 **Automatic isolation** — each session gets its own branch and worktree
- 📱 **Mobile-friendly** — no need to type `/work` with branch names
- 🗑️ **Delete button** — removes worktree when done
- 🚀 **Create PR button** — easily create pull requests from worktree
- ⚡ **Per-project setting** — enable/disable independently for each project

### `/model` — Manage AI Models

Manage which AI model is used for the current channel.

```
/model list
/model set name:google/gemini-2.0-flash
```

| Subcommand | Description                                 |
| ---------- | ------------------------------------------- |
| `list`     | List all available models from OpenCode CLI |
| `set`      | Set the model to use in this channel        |

### `/setports` — Configure Port Range

Set the range of ports the bot can use for OpenCode server instances.

```
/setports min:3000 max:4000
```

| Parameter | Description                    |
| --------- | ------------------------------ |
| `min`     | Minimum port number (>= 1024)  |
| `max`     | Maximum port number (<= 65535) |

### `/queue` — Manage Message Queue

Control the automated job queue for the current thread.

```
/queue list
/queue clear
/queue pause
/queue resume
/queue settings continue_on_failure:True fresh_context:True
```

**How it works:**

1. Send multiple messages to a thread (or use `/opencode` multiple times)
2. If the bot is busy, it reacts with `📥` and adds the task to the queue
3. Once the current job is done, the bot automatically picks up the next one

**Settings:**

- `continue_on_failure`: If `True`, the bot moves to the next task even if the current one fails.
- `fresh_context`: If `True` (default), the AI forgets previous chat history for each new queued task to improve performance, while maintaining the same code state.

---

## Usage Workflow

### Basic Workflow

1. **Register your project:**

   ```
   /setpath alias:webapp path:/home/user/my-webapp
   ```

2. **Bind to a channel:**

   ```
   /use alias:webapp
   ```

3. **Start coding remotely:**

   ```
   /opencode prompt:Refactor the authentication module to use JWT
   ```

4. **Continue the conversation** in the created thread:
   ```
   /opencode prompt:Now add refresh token support
   ```

### Mobile Workflow

Perfect for when you're away from your desk:

1. 📱 Open Discord on your phone
2. Navigate to your bound channel
3. Use `/opencode` to send tasks
4. Watch real-time progress
5. Use the **Interrupt** button if needed

**Pro tip:** Enable passthrough mode with `/code` in a thread for an even smoother mobile experience — just type messages directly without slash commands!

### Team Collaboration Workflow

Share AI coding sessions with your team:

1. Create a dedicated Discord channel for your project
2. Bind the project: `/use alias:team-project`
3. Team members can watch sessions in real-time
4. Discuss in threads while AI works

### Automated Iteration Workflow

Perfect for "setting and forgetting" several tasks:

1. **Send multiple instructions:**

   ```
   You: Refactor the API
   Bot: [Starts working]
   You: Add documentation to the new methods
   Bot: 📥 [Queued]
   You: Run tests and fix any issues
   Bot: 📥 [Queued]
   ```

2. **The bot will finish the API refactor, then automatically start the documentation task, then run the tests.**

3. **Monitor progress:** Use `/queue list` to see pending tasks.

---

## Configuration

All configuration is stored in `~/.remote-opencode/`:

| File          | Purpose                                       |
| ------------- | --------------------------------------------- |
| `config.json` | Bot credentials (token, client ID, guild ID)  |
| `data.json`   | Project paths, channel bindings, session data |

### config.json Structure

```json
{
  "discordToken": "your-bot-token",
  "clientId": "your-application-id",
  "guildId": "your-server-id"
}
```

### data.json Structure

```json
{
  "projects": [
    { "alias": "myapp", "path": "/Users/you/projects/my-app", "autoWorktree": true }
  ],
  "bindings": [
    { "channelId": "channel-id", "projectAlias": "myapp" }
  ],
  "threadSessions": [ ... ],
  "worktreeMappings": [ ... ]
}
```

| Field                     | Description                                               |
| ------------------------- | --------------------------------------------------------- |
| `projects[].autoWorktree` | Optional. When `true`, new sessions auto-create worktrees |

---

## Troubleshooting

### Bot doesn't respond to commands

1. **Check bot is online:** Look for the bot in your server's member list
2. **Verify permissions:** Bot needs these permissions:
   - Send Messages
   - Create Public Threads
   - Send Messages in Threads
   - Embed Links
   - Read Message History
3. **Redeploy commands:**
   ```bash
   remote-opencode deploy
   ```

### "No project set for this channel"

You need to bind a project to the channel:

```
/setpath alias:myproject path:/path/to/project
/use alias:myproject
```

### Commands not appearing in Discord

Slash commands can take up to an hour to propagate globally. For faster updates:

1. Kick the bot from your server
2. Re-invite it
3. Run `remote-opencode deploy`

### OpenCode server errors

1. **Verify OpenCode is installed:**
   ```bash
   opencode --version
   ```
2. **Check if another process is using the port**
3. **Ensure the project path exists and is accessible**

### Session connection issues

The bot maintains persistent sessions. If you encounter issues:

1. Start a new thread with `/opencode` instead of continuing in an old one
2. Restart the bot: `remote-opencode start`

### Bot crashes on startup

1. **Check Node.js version:**
   ```bash
   node --version  # Should be 22+
   ```
2. **Verify configuration:**
   ```bash
   remote-opencode config
   ```
3. **Re-run setup:**
   ```bash
   remote-opencode setup
   ```

---

## Development

### Run from source

```bash
git clone https://github.com/Dayclone/remote-opencode.git
cd remote-opencode
npm install

# Development mode (with ts-node)
npm run dev setup   # Run setup
npm run dev start   # Start bot

# Code Quality
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript check
npm run format:check # Verify code formatting

# Build and run production
npm run build
npm start
```

### Run tests

```bash
npm test
```

### Project Structure

```
src/
├── cli.ts                 # CLI entry point
├── bot.ts                 # Discord client initialization
├── commands/              # Slash command definitions
│   ├── opencode.ts        # Main AI interaction command
│   ├── code.ts            # Passthrough mode toggle
│   ├── work.ts            # Worktree management
│   ├── setpath.ts         # Project registration
│   ├── projects.ts        # List projects
│   └── use.ts             # Channel binding
├── handlers/              # Interaction handlers
│   ├── interactionHandler.ts
│   ├── buttonHandler.ts
│   └── messageHandler.ts  # Passthrough message handling
├── services/              # Core business logic
│   ├── serveManager.ts    # OpenCode process management
│   ├── sessionManager.ts  # Session state management
│   ├── queueManager.ts    # Automated job queuing
│   ├── executionService.ts # Core prompt execution logic
│   ├── sseClient.ts       # Real-time event streaming

│   ├── dataStore.ts       # Persistent storage
│   ├── configStore.ts     # Bot configuration
│   └── worktreeManager.ts # Git worktree operations
├── setup/                 # Setup wizard
│   ├── wizard.ts          # Interactive setup
│   └── deploy.ts          # Command deployment
└── utils/                 # Utilities
    ├── messageFormatter.ts
    └── threadHelper.ts
```

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a full history of changes.

### [1.2.1] - 2026-02-05

#### Added

- **Guided Onboarding**: Added an interactive prompt that automatically offers to run the setup wizard if the bot is launched without any configuration.
- **Improved Windows Experience**: Enhanced the standalone EXE behavior to prevent the terminal window from closing immediately after showing help text.

#### Changed

- **CLI Robustness**: Consolidated default actions in the CLI to improve first-time user experience.

### [1.2.0] - 2026-02-05

#### Added

- **Standalone Executable**: Full support for building a single, standalone `.exe` using Node.js SEA.
- **New `/diff` Command**: View git changes (staged or unstaged) directly in Discord.
- **CI/CD Pipeline**: Fully automated testing and release system that builds and attaches the EXE to every release.
- **Node 24 Support**: Optimized for the latest Node.js runtimes.

#### Fixed

- **Security**: Forced `undici@^6.23.0` to resolve security advisories.
- **Cleanup**: Removed unused `node-pty` dependency.

### [1.1.0] - 2026-02-05

#### Added

- **Automated Message Queuing**: Added a new system to queue multiple prompts in a thread. If the bot is busy, new messages are automatically queued and processed sequentially.
- **Queue Management**: New `/queue` slash command suite to list, clear, pause, resume, and configure queue settings.

---

## License

MIT

---

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) before submitting a Pull Request.
