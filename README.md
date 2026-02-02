# remote-opencode

> Control your AI coding assistant from anywhere — your phone, tablet, or another computer.

**remote-opencode** is a Discord bot that bridges your local [OpenCode CLI](https://github.com/sst/opencode) to Discord, enabling you to interact with your AI coding assistant remotely. Perfect for developers who want to:

- 📱 **Code from mobile** — Send coding tasks from your phone while away from your desk
- 💻 **Access from any device** — Use your powerful dev machine from a laptop or tablet
- 🌍 **Work remotely** — Control your home/office workstation from anywhere
- 👥 **Collaborate** — Share AI coding sessions with team members in Discord

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
  - [Step 1: Create Discord Application](#step-1-create-discord-application)
  - [Step 2: Create Bot & Get Token](#step-2-create-bot--get-token)
  - [Step 3: Enable Required Intents](#step-3-enable-required-intents)
  - [Step 4: Configure Bot Permissions](#step-4-configure-bot-permissions)
  - [Step 5: Get Your Server (Guild) ID](#step-5-get-your-server-guild-id)
  - [Step 6: Invite Bot to Your Server](#step-6-invite-bot-to-your-server)
- [CLI Commands](#cli-commands)
- [Discord Slash Commands](#discord-slash-commands)
- [Usage Workflow](#usage-workflow)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [License](#license)

---

## Installation

### Prerequisites

- **Node.js 22+** — [Download](https://nodejs.org/)
- **OpenCode CLI** — Must be installed and working on your machine
- **Discord Account** — With a server where you have admin permissions

### Install via npm

```bash
# Global installation (recommended)
npm install -g remote-opencode

# Or run directly with npx
npx remote-opencode
```

### Install from source

```bash
git clone https://github.com/RoundTable02/remote-opencode.git
cd remote-opencode
npm install
npm run build
npm link  # Makes 'remote-opencode' available globally
```

---

## Quick Start

```bash
# Step 1: Run the interactive setup wizard
remote-opencode setup

# Step 2: Start the Discord bot
remote-opencode start
```

That's it! Now use Discord slash commands to interact with OpenCode.

---

## Discord Bot Setup

Before using remote-opencode, you need to create a Discord Application and Bot. The setup wizard will guide you, but here's a visual walkthrough:

### Step 1: Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **"New Application"**
3. Enter a name (e.g., "Remote OpenCode")
4. Copy the **Application ID** — you'll need this later

<img width="800" alt="image" src="https://github.com/user-attachments/assets/ca2e7ff3-91e7-4d66-93dc-c166189c0107" />

### Step 2: Create Bot & Get Token

1. Navigate to the **"Bot"** section in the sidebar
2. Click **"Reset Token"** (or "View Token" if available)
3. **Copy the token immediately** — it's only shown once!
4. Keep this token secret — never share it publicly


### Step 3: Enable Required Intents

Still in the **"Bot"** section, scroll down to **"Privileged Gateway Intents"** and enable:

- ✅ **SERVER MEMBERS INTENT**
- ✅ **MESSAGE CONTENT INTENT**

Click **"Save Changes"**

<img width="1500" alt="image" src="https://github.com/user-attachments/assets/d20406ff-26ad-4204-9771-b157c340846a" />

### Step 4: Configure Bot Permissions

The bot needs specific permissions to function properly. You can configure permissions in two ways:

#### Option A: Using OAuth2 URL Generator (Recommended)

1. Navigate to the **"OAuth2"** section in the sidebar
2. Click on **"URL Generator"**
3. In **"Scopes"**, select:
   - ✅ `bot`
   - ✅ `applications.commands`
4. In **"Bot Permissions"**, select only these essential permissions:
   
   **General Permissions:**
   - ✅ **View Channels** — Required to access channels
   
   **Text Permissions:**
   - ✅ **Send Messages** — Send responses to channels
   - ✅ **Create Public Threads** — Create threads for each `/opencode` session
   - ✅ **Send Messages in Threads** — Reply within threads
   - ✅ **Embed Links** — Send formatted embed messages
   - ✅ **Read Message History** — Access context for conversations
   - ✅ **Add Reactions** — Add buttons (uses emoji reactions internally)
   - ✅ **Use Slash Commands** — Register and use slash commands

5. Copy the generated URL at the bottom — this is your bot invite link!


#### Option B: Manual Permission Calculation

If you're building the URL manually, use this permission value:

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=311385214016&integration_type=0&scope=bot+applications.commands
```

**Important:** The URL must include `applications.commands` scope for slash commands to work!

### Step 5: Get Your Server (Guild) ID

1. Open Discord and go to **User Settings → Advanced**
2. Enable **"Developer Mode"**
3. Right-click on your server name in the sidebar
4. Click **"Copy Server ID"**

<!-- SCREENSHOT: Discord showing Copy Server ID option -->
<!-- ![Copy Server ID](./docs/images/04-guild-id.png) -->
*Screenshot placeholder: Right-click menu showing "Copy Server ID" option*

### Step 6: Invite Bot to Your Server

Use the URL generated in Step 4 (OAuth2 URL Generator), or construct it manually:

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=218900185540&scope=bot%20applications.commands
```

1. Replace `YOUR_CLIENT_ID` with your Application ID
2. Open the URL in your browser
3. Select your server and authorize

<img width="184" height="530" alt="스크린샷 2026-02-03 오전 2 34 31" src="https://github.com/user-attachments/assets/8ecc2a28-05e5-494f-834f-95d9d0e4e730" />


---

## CLI Commands

| Command | Description |
|---------|-------------|
| `remote-opencode` | Start the bot (shows setup guide if not configured) |
| `remote-opencode setup` | Interactive setup wizard — configures bot token, IDs |
| `remote-opencode start` | Start the Discord bot |
| `remote-opencode deploy` | Deploy/update slash commands to Discord |
| `remote-opencode config` | Display current configuration info |

---

## Discord Slash Commands

Once the bot is running, use these commands in your Discord server:

### `/setpath` — Register a Project

Register a local project path with an alias for easy reference.

```
/setpath alias:myapp path:/Users/you/projects/my-app
```

| Parameter | Description |
|-----------|-------------|
| `alias` | Short name for the project (e.g., `myapp`, `backend`) |
| `path` | Absolute path to the project on your machine |

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

| Parameter | Description |
|-----------|-------------|
| `branch` | Git branch name (will be sanitized) |
| `description` | Brief description of the work |

**Features:**
- 🌳 Creates a new git worktree for isolated work
- 🧵 Opens a dedicated thread for the task
- 🗑️ **Delete button** — removes worktree and archives thread
- 🚀 **Create PR button** — automatically creates a pull request

This is perfect for working on multiple features simultaneously without branch switching.

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

### Team Collaboration Workflow

Share AI coding sessions with your team:

1. Create a dedicated Discord channel for your project
2. Bind the project: `/use alias:team-project`
3. Team members can watch sessions in real-time
4. Discuss in threads while AI works

### Worktree Workflow (Parallel Features)

Work on multiple features without conflicts:

1. **Start a new feature:**
   ```
   /work branch:feature/auth description:Implement OAuth2 login
   ```

2. **Work in the created thread:**
   ```
   /opencode prompt:Add Google OAuth provider
   ```

3. **When done, create a PR:**
   Click the **Create PR** button

4. **Clean up:**
   Click **Delete** to remove the worktree

---

## Configuration

All configuration is stored in `~/.remote-opencode/`:

| File | Purpose |
|------|---------|
| `config.json` | Bot credentials (token, client ID, guild ID) |
| `data.json` | Project paths, channel bindings, session data |

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
  "projects": {
    "myapp": "/Users/you/projects/my-app"
  },
  "bindings": {
    "channel-id": "myapp"
  },
  "threadSessions": { ... },
  "worktreeMappings": { ... }
}
```

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
git clone https://github.com/RoundTable02/remote-opencode.git
cd remote-opencode
npm install

# Development mode (with ts-node)
npm run dev setup   # Run setup
npm run dev start   # Start bot

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
│   ├── work.ts            # Worktree management
│   ├── setpath.ts         # Project registration
│   ├── projects.ts        # List projects
│   └── use.ts             # Channel binding
├── handlers/              # Interaction handlers
│   ├── interactionHandler.ts
│   └── buttonHandler.ts
├── services/              # Core business logic
│   ├── serveManager.ts    # OpenCode process management
│   ├── sessionManager.ts  # Session state management
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

## License

MIT

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
