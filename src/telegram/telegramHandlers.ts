import type { Context } from 'grammy';
import * as dataStore from '../services/dataStore.js';
import * as sessionManager from '../services/sessionManager.js';
import * as serveManager from '../services/serveManager.js';
import * as worktreeManager from '../services/worktreeManager.js';

// --- In-memory shortcut registries ---
// Maps numeric index -> real name, per chat.
// Rebuilt each time /sps or /lm is called.
// e.g. projectShortcuts.get("12345") = ["remote-opencode", "open-webui", ...]
const projectShortcuts = new Map<string, string[]>();
const modelShortcuts = new Map<string, string[]>();
import { isTelegramChatAuthorized, getProjectsBasePaths, getOpenCodeConfigPath } from '../services/configStore.js';
import { transcribe, isVoiceEnabled } from '../services/voiceService.js';
import { isBusy } from './telegramQueueManager.js';
import { runPrompt } from './telegramExecutionService.js';
import { getCachedModels } from '../commands/model.js';

// --- Helpers ---

function getThreadId(ctx: Context): string {
  const chatId = ctx.chat!.id.toString();
  const topicId = ctx.message?.message_thread_id;
  return topicId ? `${chatId}:${topicId}` : chatId;
}

function getParentChatId(ctx: Context): string {
  return ctx.chat!.id.toString();
}

function checkAuth(ctx: Context): boolean {
  return isTelegramChatAuthorized(ctx.chat!.id.toString());
}

/**
 * Encode alias for Telegram commands: replace hyphens with double underscores.
 * Telegram treats hyphens as command boundary, so /sp_open-webui breaks.
 * We encode it as /sp_open__webui instead.
 */
/**
 * Encode a project alias for use in a Telegram command.
 * Telegram commands only allow [a-zA-Z0-9_], max 64 chars total (incl. prefix).
 * Encoding: hyphens -> __, dots -> _P_
 * e.g. "blog.weisser.dev" -> "blog_P_weisser_P_dev"
 * Only used for /sp_<alias> backward-compat. /sps now uses numeric indices.
 */
function encodeAlias(alias: string): string {
  return alias.replace(/-/g, '__').replace(/\./g, '_P_');
}

/** Decode alias back from Telegram command form to original name. */
function decodeAlias(encoded: string): string {
  return encoded.replace(/_P_/g, '.').replace(/__/g, '-');
}

/** Get the chat-scoped shortcut key (chatId, or chatId:topicId for forum groups) */
function getShortcutKey(ctx: Context): string {
  const chatId = ctx.chat!.id.toString();
  const topicId = ctx.message?.message_thread_id;
  return topicId ? `${chatId}:${topicId}` : chatId;
}

/** Look up the display shortcut for a project alias in the registry, e.g. "sp3 - myproject" */
export function getProjectShortcutLabel(threadId: string, alias: string): string {
  const registry = projectShortcuts.get(threadId) ?? [];
  const idx = registry.indexOf(alias);
  return idx >= 0 ? `sp${idx + 1} - ${alias}` : alias;
}

/** Look up the display shortcut for a model name in the registry, e.g. "sm2 - claude-sonnet-4-6" */
export function getModelShortcutLabel(threadId: string, modelName: string): string {
  const registry = modelShortcuts.get(threadId) ?? [];
  const idx = registry.indexOf(modelName);
  return idx >= 0 ? `sm${idx + 1} - ${modelName}` : modelName;
}

/** Get the currently bound project alias + path for this chat, or undefined. */
function getCurrentProject(ctx: Context): { alias: string; path: string } | undefined {
  const chatId = getParentChatId(ctx);
  const alias = dataStore.getChannelBinding(chatId);
  if (!alias) return undefined;
  const project = dataStore.getProject(alias);
  if (!project) return undefined;
  return { alias: project.alias, path: project.path };
}

/** Get the current model name for this chat, or 'default'. */
function getCurrentModel(ctx: Context): string {
  const chatId = getParentChatId(ctx);
  return dataStore.getChannelModel(chatId) || 'default';
}

/** Build the commands help text. */
function commandsList(): string {
  return [
    '',
    'Commands:',
    '',
    '— Vibe Coding —',
    '/vibe_coding - start a vibe coding session',
    '/stop_coding - stop the current session',
    '',
    '— Projects —',
    '/list_projects - show all projects (readable)',
    '/sps - show clickable project shortcuts (tap to switch)',
    '/sp <name> - switch project (short alias)',
    '/switch_project <name> - switch project (full command)',
    '',
    '— Models —',
    '/list_models - show all models (readable)',
    '/lm - show clickable model shortcuts (tap to switch)',
    '/switch_model <name> - switch model',
    '',
    '— Info & Control —',
    '/status - current project, model & session',
    '/diff - git diff of current project',
    '/interrupt - stop the current running task',
    '/queue_list - show task queue',
    '/queue_clear - clear task queue',
    '',
    '— Stats —',
    '/hide_stats - hide token usage & costs',
    '/show_stats - show token usage & costs',
    '',
    '/help - show this message',
  ].join('\n');
}

// ============================================================
//  /start - Smart onboarding
// ============================================================

export async function handleStart(ctx: Context): Promise<void> {
  if (!checkAuth(ctx)) {
    await ctx.reply("Hey! Looks like you're not on the guest list. Ask the admin to add your chat ID.");
    return;
  }

  const basePaths = getProjectsBasePaths();
  const configPath = getOpenCodeConfigPath();
  const projects = dataStore.getProjects();
  const current = getCurrentProject(ctx);

  // --- Not configured at all ---
  if (basePaths.length === 0 && projects.length === 0) {
    await ctx.reply(
      "Hey, I'm here! 👋\n\n" +
      "It looks like you haven't configured me yet.\n" +
      "Run this on your machine first:\n\n" +
      "  remote-opencode configure\n\n" +
      "That will set up your projects base path, opencode config, and everything else.\n" +
      "Once that's done, come back and say /start again!"
    );
    return;
  }

  // --- Configured but no project bound to this chat ---
  if (!current) {
    const projectCount = projects.length;
    let msg =
      "Hey, looks like I'm configured just fine! 🎉\n\n" +
      `Your projects are stored under: ${basePaths.join(', ')}\n` +
      (configPath ? `OpenCode config: ${configPath}\n` : '') +
      `I found ${projectCount} project${projectCount !== 1 ? 's' : ''}.\n\n` +
      "But you haven't picked a project for this chat yet.\n" +
      "Type /list_projects to see what's available, then\n" +
      "/switch_project <name> to pick one.\n\n" +
      "After that, just type /vibe_coding and we'll get rolling!";
    await ctx.reply(msg);
    return;
  }

  // --- Fully configured, project bound ---
  const model = getCurrentModel(ctx);
  await ctx.reply(
    "Hey, looks like I'm configured and ready to go! 🚀\n\n" +
    `Current project: ${current.alias}\n` +
    `  Path: ${current.path}\n` +
    `Model: ${model}\n\n` +
    "Everything look right? If so, just type /vibe_coding and we start our vibe coding session!\n\n" +
    "To switch things up:\n" +
    "  /switch_project <name> - change project\n" +
    "  /switch_model <name> - change model\n" +
    "  /list_projects - see all projects\n" +
    "  /list_models - see all models\n" +
    commandsList()
  );
}

// ============================================================
//  /help
// ============================================================

export async function handleHelp(ctx: Context): Promise<void> {
  if (!checkAuth(ctx)) return;

  const current = getCurrentProject(ctx);
  const model = getCurrentModel(ctx);

  let header = '';
  if (current) {
    header = `You're in project: ${current.alias} (model: ${model})\n`;
  } else {
    header = "No project selected yet. Use /switch_project <name> first.\n";
  }

  await ctx.reply(header + commandsList());
}

// ============================================================
//  /list_projects - human-readable list
// ============================================================

export async function handleListProjects(ctx: Context): Promise<void> {
  if (!checkAuth(ctx)) return;

  const projects = dataStore.getProjects();
  if (projects.length === 0) {
    await ctx.reply(
      "No projects found.\n" +
      "Make sure your projects base path is configured.\n" +
      "Run: remote-opencode configure"
    );
    return;
  }

  const current = getCurrentProject(ctx);
  const lines = projects.map(p => {
    const marker = current && p.alias === current.alias ? ' << current' : '';
    return `  ${p.alias}${marker}`;
  });

  const header = `Projects (${projects.length}):\n\n`;
  const footer = '\nSwitch: /sp <name>  |  Clickable: /sps';
  const fullMsg = header + lines.join('\n') + footer;

  if (fullMsg.length > 4000) {
    for (let i = 0; i < lines.length; i += 50) {
      const chunk = lines.slice(i, i + 50).join('\n');
      await ctx.reply(i === 0 ? header + chunk : chunk);
    }
    await ctx.reply(footer.trim());
  } else {
    await ctx.reply(fullMsg);
  }
}

// ============================================================
//  /sps - clickable project shortcuts (like /lm for models)
// ============================================================

export async function handleListProjectsClickable(ctx: Context): Promise<void> {
  if (!checkAuth(ctx)) return;

  const projects = dataStore.getProjects();
  if (projects.length === 0) {
    await ctx.reply("No projects found. Run: remote-opencode configure");
    return;
  }

  const key = getShortcutKey(ctx);
  projectShortcuts.set(key, projects.map(p => p.alias));

  const current = getCurrentProject(ctx);
  const lines: string[] = ['Tap to switch project:\n'];

  projects.forEach((p, i) => {
    const idx = i + 1;
    const marker = current && p.alias === current.alias ? ' << current' : '';
    lines.push(`/sp${idx} - ${p.alias}${marker}`);
  });

  const response = lines.join('\n');

  if (response.length > 4000) {
    for (let i = 0; i < lines.length; i += 50) {
      await ctx.reply(lines.slice(i, i + 50).join('\n'));
    }
  } else {
    await ctx.reply(response);
  }
}

// ============================================================
//  /switch_project <name>, /sp <name>, /sp1..N index shortcuts
// ============================================================

export async function handleSwitchProject(ctx: Context): Promise<void> {
  if (!checkAuth(ctx)) {
    await ctx.reply("You're not authorized.");
    return;
  }

  const text = ctx.message?.text ?? '';
  const key = getShortcutKey(ctx);
  let alias = '';

  const indexMatch = text.match(/^\/sp(\d+)(\s|$)/);
  if (indexMatch) {
    // /sp1, /sp2, ... from /sps
    const idx = parseInt(indexMatch[1], 10) - 1;
    const registry = projectShortcuts.get(key) ?? [];
    alias = registry[idx] ?? '';
    if (!alias) {
      await ctx.reply(`No project at index ${idx + 1}. Type /sps to see the current list.`);
      return;
    }
  } else if (text.startsWith('/sp_')) {
    // Legacy encoded shortcut: /sp_open__webui
    const encoded = text.replace(/^\/sp_/, '').split(/\s/)[0].trim();
    alias = decodeAlias(encoded);
  } else if (/^\/sp(\s|$)/.test(text)) {
    // Short alias: /sp myproject
    alias = text.replace(/^\/sp\s*/, '').trim();
  } else {
    // Full command: /switch_project myproject
    alias = text.replace(/^\/switch_project\s*/, '').trim();
  }

  if (!alias) {
    await ctx.reply("Usage: /switch_project <name>\n\nType /list_projects to see available projects.");
    return;
  }

  const project = dataStore.getProject(alias);
  if (!project) {
    await ctx.reply(
      `Project '${alias}' not found.\n` +
      "Type /list_projects to see what's available."
    );
    return;
  }

  const chatId = ctx.chat!.id.toString();
  dataStore.setChannelBinding(chatId, alias);

  const model = getCurrentModel(ctx);
  await ctx.reply(
    `Switched to: ${alias}\n` +
    `Path: ${project.path}\n` +
    `Model: ${model}\n\n` +
    `Ready! Tap /vibe_coding to start`
  );
}

// ============================================================
//  /switch_model <name>
// ============================================================

export async function handleSwitchModel(ctx: Context): Promise<void> {
  if (!checkAuth(ctx)) return;

  const text = ctx.message?.text ?? '';
  const key = getShortcutKey(ctx);
  let modelName = '';

  const indexMatch = text.match(/^\/sm(\d+)(\s|$)/);
  if (indexMatch) {
    // /sm1, /sm2, ... from /lm
    const idx = parseInt(indexMatch[1], 10) - 1;
    const registry = modelShortcuts.get(key) ?? [];
    modelName = registry[idx] ?? '';
    if (!modelName) {
      await ctx.reply(`No model at index ${idx + 1}. Type /lm to see the current list.`);
      return;
    }
  } else {
    modelName = text.replace(/^\/switch_model\s*/, '').trim();
  }

  if (!modelName) {
    await ctx.reply("Usage: /switch_model <model_name>\n\nType /list_models to see available models.");
    return;
  }

  const chatId = ctx.chat!.id.toString();
  const projectAlias = dataStore.getChannelBinding(chatId);
  if (!projectAlias) {
    await ctx.reply("Pick a project first: /switch_project <name>");
    return;
  }

  try {
    const available = getCachedModels();
    if (available.length > 0 && !available.includes(modelName)) {
      await ctx.reply(`Model '${modelName}' not found.\nType /list_models to see what's available.`);
      return;
    }
  } catch {
    // can't validate, allow anyway
  }

  dataStore.setChannelModel(chatId, modelName);
  await ctx.reply(`Model switched to: ${modelName}\n\nType /vibe_coding to start coding!`);
}

// ============================================================
//  /list_models - human-readable list
// ============================================================

export async function handleListModels(ctx: Context): Promise<void> {
  if (!checkAuth(ctx)) return;

  try {
    const models = getCachedModels();
    if (models.length === 0) {
      await ctx.reply("No models found. Make sure opencode is installed and configured.");
      return;
    }

    const groups: Record<string, string[]> = {};
    for (const m of models) {
      const [provider] = m.split('/');
      if (!groups[provider]) groups[provider] = [];
      groups[provider].push(m);
    }

    const currentModel = getCurrentModel(ctx);
    let response = `Available Models (current: ${currentModel}):\n\n`;
    for (const [provider, providerModels] of Object.entries(groups)) {
      response += `${provider}:\n`;
      response += providerModels.map(m => {
        const marker = m === currentModel ? ' << current' : '';
        return `  ${m}${marker}`;
      }).join('\n') + '\n\n';
    }
    response += 'Switch: /switch_model <name>\nClickable shortcuts: /lm';

    if (response.length > 4000) {
      const chunks: string[] = [];
      let current = '';
      for (const line of response.split('\n')) {
        if (current.length + line.length + 1 > 4000) {
          chunks.push(current);
          current = '';
        }
        current += line + '\n';
      }
      if (current) chunks.push(current);
      for (const chunk of chunks) {
        await ctx.reply(chunk);
      }
    } else {
      await ctx.reply(response);
    }
  } catch {
    await ctx.reply("Failed to retrieve models.");
  }
}

// ============================================================
//  /lm - clickable model shortcuts (index-based, max 64 chars)
// ============================================================

export async function handleListModelsClickable(ctx: Context): Promise<void> {
  if (!checkAuth(ctx)) return;

  try {
    const models = getCachedModels();
    if (models.length === 0) {
      await ctx.reply("No models found.");
      return;
    }

    const key = getShortcutKey(ctx);
    modelShortcuts.set(key, models);

    const currentModel = getCurrentModel(ctx);
    const lines: string[] = ['Tap to switch model:\n'];

    models.forEach((m, i) => {
      const idx = i + 1;
      const marker = m === currentModel ? ' << current' : '';
      // Show: /sm1 - AIC Bedrock/claude-sonnet-4-6
      lines.push(`/sm${idx} - ${m}${marker}`);
    });

    const response = lines.join('\n');

    if (response.length > 4000) {
      const chunks: string[] = [];
      let current = '';
      for (const line of response.split('\n')) {
        if (current.length + line.length + 1 > 4000) {
          chunks.push(current);
          current = '';
        }
        current += line + '\n';
      }
      if (current) chunks.push(current);
      for (const chunk of chunks) await ctx.reply(chunk);
    } else {
      await ctx.reply(response);
    }
  } catch {
    await ctx.reply("Failed to retrieve models.");
  }
}

// ============================================================
//  /vibe_coding - Start a vibe coding session
// ============================================================

export async function handleVibeCoding(ctx: Context): Promise<void> {
  if (!checkAuth(ctx)) return;

  const current = getCurrentProject(ctx);
  if (!current) {
    await ctx.reply(
      "No project selected yet!\n" +
      "Type /list_projects to see your projects, then\n" +
      "/switch_project <name> to pick one."
    );
    return;
  }

  const threadId = getThreadId(ctx);
  const model = getCurrentModel(ctx);

  // Enable passthrough
  dataStore.setPassthroughMode(threadId, true, ctx.from!.id.toString());

  await ctx.reply(
    `🎧 Vibe Coding started!\n\n` +
    `Project: ${current.alias}\n` +
    `Path: ${current.path}\n` +
    `Model: ${model}\n\n` +
    "Just type what you want me to do - no commands needed.\n" +
    "I'll send everything straight to OpenCode.\n\n" +
    "To switch project: /switch_project <name>\n" +
    "To switch model: /switch_model <name>\n" +
    "To stop: /stop_coding"
  );
}

// ============================================================
//  /stop_coding - Stop vibe coding session
// ============================================================

export async function handleStopCoding(ctx: Context): Promise<void> {
  if (!checkAuth(ctx)) return;

  const threadId = getThreadId(ctx);

  if (!dataStore.isPassthroughEnabled(threadId)) {
    await ctx.reply("No active vibe coding session. Start one with /vibe_coding");
    return;
  }

  dataStore.setPassthroughMode(threadId, false, ctx.from!.id.toString());

  await ctx.reply(
    "Vibe coding session ended.\n" +
    "Use /vibe_coding to start a new one."
  );
}

// ============================================================
//  /status - Show current state
// ============================================================

export async function handleStatus(ctx: Context): Promise<void> {
  if (!checkAuth(ctx)) return;

  const current = getCurrentProject(ctx);
  const model = getCurrentModel(ctx);
  const threadId = getThreadId(ctx);
  const vibing = dataStore.isPassthroughEnabled(threadId);
  const session = sessionManager.getSessionForThread(threadId);
  const busy = session ? !!(sessionManager.getSseClient(threadId)?.isConnected()) : false;

  let msg = '--- Status ---\n\n';

  if (current) {
    msg += `Project: ${current.alias}\n`;
    msg += `Path: ${current.path}\n`;
  } else {
    msg += 'Project: none (use /switch_project)\n';
  }

  msg += `Model: ${model}\n`;
  msg += `Vibe coding: ${vibing ? 'active' : 'off'}\n`;

  if (session) {
    const info = await sessionManager.getSessionInfo(session.port, session.sessionId).catch(() => null);
    msg += `Session: ${info?.title || session.sessionId.slice(0, 8)}\n`;
    msg += `Busy: ${busy ? 'yes' : 'no'}\n`;
  } else {
    msg += 'Session: none\n';
  }

  const queue = dataStore.getQueue(threadId);
  if (queue.length > 0) {
    msg += `Queue: ${queue.length} item${queue.length > 1 ? 's' : ''}\n`;
  }

  await ctx.reply(msg);
}

// ============================================================
//  /opencode <prompt> - One-shot prompt (still available)
// ============================================================

export async function handleOpencode(ctx: Context): Promise<void> {
  if (!checkAuth(ctx)) {
    await ctx.reply("You're not authorized.");
    return;
  }

  const text = ctx.message?.text ?? '';
  const prompt = text.replace(/^\/opencode\s*/, '').trim();

  if (!prompt) {
    await ctx.reply("Usage: /opencode <prompt>\nOr just use /vibe_coding and type naturally!");
    return;
  }

  const chatId = ctx.chat!.id;
  const parentChatId = getParentChatId(ctx);
  const threadId = getThreadId(ctx);
  const topicId = ctx.message?.message_thread_id;

  if (!dataStore.getChannelProjectPath(parentChatId)) {
    await ctx.reply("No project selected. Use /switch_project <name> first.");
    return;
  }

  if (isBusy(threadId)) {
    dataStore.addToQueue(threadId, { prompt, userId: ctx.from!.id.toString(), timestamp: Date.now() });
    await ctx.reply('Busy - added to queue.');
    return;
  }

  await runPrompt(ctx.api, chatId, topicId, threadId, prompt, parentChatId);
}

// ============================================================
//  /hide_stats & /show_stats
// ============================================================

export async function handleHideStats(ctx: Context): Promise<void> {
  if (!checkAuth(ctx)) return;
  const threadId = getThreadId(ctx);
  dataStore.setStatsVisible(threadId, false);
  await ctx.reply("Stats hidden. Type /show_stats to bring them back.");
}

export async function handleShowStats(ctx: Context): Promise<void> {
  if (!checkAuth(ctx)) return;
  const threadId = getThreadId(ctx);
  dataStore.setStatsVisible(threadId, true);
  await ctx.reply("Stats visible. Token usage & costs will be shown after each response.\nType /hide_stats to hide.");
}

// ============================================================
//  Legacy commands (kept for backward compat)
// ============================================================

export async function handleSetpath(ctx: Context): Promise<void> {
  if (!checkAuth(ctx)) return;
  const text = ctx.message?.text ?? '';
  const parts = text.split(/\s+/).slice(1);
  if (parts.length < 2) {
    await ctx.reply('Usage: /setpath <alias> <path>');
    return;
  }
  dataStore.addProject(parts[0], parts.slice(1).join(' '));
  await ctx.reply(`Project '${parts[0]}' registered.`);
}

export async function handleDiff(ctx: Context): Promise<void> {
  if (!checkAuth(ctx)) return;

  const threadId = getThreadId(ctx);
  const parentChatId = getParentChatId(ctx);
  const projectPath = dataStore.getChannelProjectPath(parentChatId);

  if (!projectPath) {
    await ctx.reply('No project selected. Use /switch_project first.');
    return;
  }

  const worktreeMapping = dataStore.getWorktreeMapping(threadId);
  const effectivePath = worktreeMapping?.worktreePath ?? projectPath;

  try {
    const { execSync } = await import('node:child_process');
    const diff = execSync('git diff', { cwd: effectivePath, encoding: 'utf-8', timeout: 10000 });
    if (!diff.trim()) {
      await ctx.reply('No changes detected.');
      return;
    }
    if (diff.length > 4000) {
      await ctx.reply(diff.slice(0, 4000) + '\n...(truncated)');
    } else {
      await ctx.reply(diff);
    }
  } catch (error) {
    await ctx.reply(`Failed to get diff: ${(error as Error).message}`);
  }
}

export async function handleInterrupt(ctx: Context): Promise<void> {
  if (!checkAuth(ctx)) return;

  const threadId = getThreadId(ctx);
  const session = sessionManager.getSessionForThread(threadId);
  if (!session) {
    await ctx.reply('Nothing running to interrupt.');
    return;
  }

  const parentChatId = getParentChatId(ctx);
  const preferredModel = dataStore.getChannelModel(parentChatId);
  const port = serveManager.getPort(session.projectPath, preferredModel);
  if (!port) {
    await ctx.reply('Server is not running.');
    return;
  }

  const success = await sessionManager.abortSession(port, session.sessionId);
  await ctx.reply(success ? 'Interrupted.' : 'Failed to interrupt.');
}

export async function handleQueueList(ctx: Context): Promise<void> {
  if (!checkAuth(ctx)) return;
  const threadId = getThreadId(ctx);
  const queue = dataStore.getQueue(threadId);
  if (queue.length === 0) {
    await ctx.reply('Queue is empty.');
    return;
  }
  const lines = queue.slice(0, 10).map((item, i) =>
    `${i + 1}. ${item.prompt.slice(0, 60)}${item.prompt.length > 60 ? '...' : ''}`
  );
  await ctx.reply(`Queue (${queue.length}):\n${lines.join('\n')}`);
}

export async function handleQueueClear(ctx: Context): Promise<void> {
  if (!checkAuth(ctx)) return;
  dataStore.clearQueue(getThreadId(ctx));
  await ctx.reply('Queue cleared.');
}

export async function handleWork(ctx: Context): Promise<void> {
  if (!checkAuth(ctx)) return;

  const text = ctx.message?.text ?? '';
  const parts = text.split(/\s+/).slice(1);
  if (parts.length < 2) {
    await ctx.reply('Usage: /work <branch> <description>');
    return;
  }

  const branchInput = parts[0];
  const description = parts.slice(1).join(' ');
  const chatId = ctx.chat!.id.toString();
  const threadId = getThreadId(ctx);
  const projectPath = dataStore.getChannelProjectPath(chatId);

  if (!projectPath) {
    await ctx.reply('No project selected. Use /switch_project first.');
    return;
  }

  const sanitizedBranch = worktreeManager.sanitizeBranchName(branchInput);
  if (dataStore.getWorktreeMappingByBranch(projectPath, sanitizedBranch)) {
    await ctx.reply(`Worktree for branch '${sanitizedBranch}' already exists.`);
    return;
  }

  try {
    const worktreePath = await worktreeManager.createWorktree(projectPath, sanitizedBranch);
    dataStore.setWorktreeMapping({
      threadId, branchName: sanitizedBranch, worktreePath, projectPath, description, createdAt: Date.now()
    });
    await ctx.reply(`Worktree created: ${sanitizedBranch}\nPath: ${worktreePath}`);
  } catch (error) {
    await ctx.reply(`Failed: ${(error as Error).message}`);
  }
}

// ============================================================
//  Message handler (passthrough / vibe coding mode)
// ============================================================

export async function handleMessage(ctx: Context): Promise<void> {
  if (ctx.message?.text?.startsWith('/')) return;

  const chatId = ctx.chat!.id;
  const threadId = getThreadId(ctx);
  const parentChatId = getParentChatId(ctx);

  // If not in vibe coding mode, ignore
  if (!dataStore.isPassthroughEnabled(threadId)) return;
  if (!checkAuth(ctx)) return;

  let prompt = ctx.message?.text?.trim() ?? '';

  // Voice messages
  const isVoiceMessage = !prompt && isVoiceEnabled() && ctx.message?.voice;
  let voiceFileUrl: string | undefined;
  let voiceFileSize: number | undefined;

  if (isVoiceMessage && ctx.message?.voice) {
    try {
      const file = await ctx.api.getFile(ctx.message.voice.file_id);
      voiceFileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
      voiceFileSize = ctx.message.voice.file_size;
    } catch {
      await ctx.reply('Failed to process voice message.');
      return;
    }
  }

  if (!prompt && !voiceFileUrl) return;

  // Queue if busy
  if (isBusy(threadId)) {
    if (voiceFileUrl) {
      dataStore.addToQueue(threadId, {
        prompt: '', userId: ctx.from!.id.toString(), timestamp: Date.now(),
        voiceAttachmentUrl: voiceFileUrl, voiceAttachmentSize: voiceFileSize,
      });
    } else {
      dataStore.addToQueue(threadId, { prompt, userId: ctx.from!.id.toString(), timestamp: Date.now() });
    }
    await ctx.reply('Queued.');
    return;
  }

  // Transcribe voice if needed
  if (voiceFileUrl) {
    try {
      prompt = await transcribe(voiceFileUrl, voiceFileSize);
    } catch {
      await ctx.reply('Voice transcription failed.');
      return;
    }
    if (!prompt.trim()) {
      await ctx.reply('Could not transcribe voice message.');
      return;
    }
  }

  // Check project is bound
  if (!dataStore.getChannelProjectPath(parentChatId)) {
    await ctx.reply("No project selected yet. Use /switch_project <name> first, then /vibe_coding.");
    return;
  }

  const topicId = ctx.message?.message_thread_id;
  await runPrompt(ctx.api, chatId, topicId, threadId, prompt, parentChatId);
}
