import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync, readdirSync, statSync, symlinkSync, unlinkSync, readlinkSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { homedir } from 'node:os';

// --- Interfaces ---

export interface BotConfig {
  discordToken: string;
  clientId: string;
  guildId: string;
}

export interface TelegramConfig {
  telegramToken: string;
  allowedChatIds?: string[];
}

export interface PortConfig {
  min: number;
  max: number;
}

/** Legacy config stored in ~/.remote-opencode/config.json */
export interface AppConfig {
  bot?: BotConfig;
  telegram?: TelegramConfig;
  ports?: PortConfig;
  allowedUserIds?: string[];
  openaiApiKey?: string;
  projectsBasePaths?: string[];
  openCodeConfigPath?: string;
}

/**
 * Local project config stored in remote-opencode.config.json (gitignored).
 * This is the primary config source. Fields here override legacy config.
 */
export interface LocalConfig {
  telegram?: {
    token?: string;
    allowedChatIds?: string[];
  };
  discord?: {
    token?: string;
    clientId?: string;
    guildId?: string;
  };
  projectsBasePaths?: string[];
  openCodeConfigPath?: string;
  allowedUserIds?: string[];
  openaiApiKey?: string;
  ports?: PortConfig;
}

// --- Path constants ---

const CONFIG_DIR = join(homedir(), '.remote-opencode');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

/**
 * Find the local config file by walking up from cwd.
 * Checks: cwd, then parent dirs up to home.
 */
function findLocalConfigFile(): string | undefined {
  const filename = 'remote-opencode.config.json';
  let dir = process.cwd();
  const root = resolve('/');

  while (dir !== root) {
    const candidate = join(dir, filename);
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

let _localConfigCache: LocalConfig | null = null;
let _localConfigPath: string | undefined;

/**
 * Load the local project config (remote-opencode.config.json).
 * Cached after first load.
 */
export function loadLocalConfig(): LocalConfig {
  if (_localConfigCache !== null) return _localConfigCache;

  _localConfigPath = findLocalConfigFile();
  if (!_localConfigPath) {
    _localConfigCache = {};
    return _localConfigCache;
  }

  try {
    const content = readFileSync(_localConfigPath, 'utf-8');
    _localConfigCache = JSON.parse(content) as LocalConfig;
  } catch {
    _localConfigCache = {};
  }
  return _localConfigCache;
}

export function getLocalConfigPath(): string | undefined {
  loadLocalConfig(); // ensure path is resolved
  return _localConfigPath;
}

/**
 * Save the local config file. Creates it in cwd if it doesn't exist yet.
 */
export function saveLocalConfig(config: LocalConfig): void {
  const path = _localConfigPath ?? join(process.cwd(), 'remote-opencode.config.json');
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  _localConfigCache = config;
  _localConfigPath = path;
}

// --- Legacy config (backward compat with ~/.remote-opencode/config.json) ---

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function loadConfig(): AppConfig {
  ensureConfigDir();
  if (!existsSync(CONFIG_FILE)) {
    return {};
  }
  try {
    const content = readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content) as AppConfig;
  } catch {
    return {};
  }
}

export function saveConfig(config: AppConfig): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { encoding: 'utf-8', mode: 0o600 });
}

// --- Discord config ---
// Priority: local config > env vars > legacy config

export function getBotConfig(): BotConfig | undefined {
  const local = loadLocalConfig();
  if (local.discord?.token && local.discord?.clientId && local.discord?.guildId) {
    return {
      discordToken: local.discord.token,
      clientId: local.discord.clientId,
      guildId: local.discord.guildId,
    };
  }
  // Env vars
  if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_CLIENT_ID && process.env.DISCORD_GUILD_ID) {
    return {
      discordToken: process.env.DISCORD_BOT_TOKEN,
      clientId: process.env.DISCORD_CLIENT_ID,
      guildId: process.env.DISCORD_GUILD_ID,
    };
  }
  return loadConfig().bot;
}

export function setBotConfig(bot: BotConfig): void {
  const config = loadConfig();
  config.bot = bot;
  saveConfig(config);
}

export function hasBotConfig(): boolean {
  const bot = getBotConfig();
  return !!(bot?.discordToken && bot?.clientId && bot?.guildId);
}

export function clearBotConfig(): void {
  const config = loadConfig();
  delete config.bot;
  saveConfig(config);
}

// --- Port config ---

export function getPortConfig(): PortConfig | undefined {
  const local = loadLocalConfig();
  if (local.ports) return local.ports;
  return loadConfig().ports;
}

export function setPortConfig(ports: PortConfig): void {
  const config = loadConfig();
  config.ports = ports;
  saveConfig(config);
}

// --- Allowlist ---

export function getAllowedUserIds(): string[] {
  const local = loadLocalConfig();
  if (local.allowedUserIds && local.allowedUserIds.length > 0) return local.allowedUserIds;
  return loadConfig().allowedUserIds ?? [];
}

export function setAllowedUserIds(ids: string[]): void {
  const config = loadConfig();
  config.allowedUserIds = ids;
  saveConfig(config);
}

export function addAllowedUserId(id: string): void {
  const config = loadConfig();
  const current = config.allowedUserIds ?? [];
  if (!current.includes(id)) {
    config.allowedUserIds = [...current, id];
    saveConfig(config);
  }
}

export function removeAllowedUserId(id: string): boolean {
  const config = loadConfig();
  const current = config.allowedUserIds ?? [];
  if (!current.includes(id)) return false;
  if (current.length <= 1) return false;
  config.allowedUserIds = current.filter(uid => uid !== id);
  saveConfig(config);
  return true;
}

export function isAuthorized(userId: string): boolean {
  const ids = getAllowedUserIds();
  if (ids.length === 0) return true;
  return ids.includes(userId);
}

// --- OpenAI API key ---

export function getOpenAIApiKey(): string | undefined {
  const local = loadLocalConfig();
  if (local.openaiApiKey) return local.openaiApiKey;
  return process.env.OPENAI_API_KEY || loadConfig().openaiApiKey;
}

export function setOpenAIApiKey(key: string): void {
  const config = loadConfig();
  config.openaiApiKey = key;
  saveConfig(config);
}

export function removeOpenAIApiKey(): void {
  const config = loadConfig();
  delete config.openaiApiKey;
  saveConfig(config);
}

// --- Telegram config ---
// Priority: local config > env var > legacy config

export function getTelegramConfig(): TelegramConfig | undefined {
  const local = loadLocalConfig();
  if (local.telegram?.token) {
    return {
      telegramToken: local.telegram.token,
      allowedChatIds: local.telegram.allowedChatIds,
    };
  }
  const envToken = process.env.TELEGRAM_BOT_TOKEN;
  if (envToken) {
    const fileConfig = loadConfig().telegram;
    return {
      telegramToken: envToken,
      allowedChatIds: fileConfig?.allowedChatIds,
    };
  }
  return loadConfig().telegram;
}

export function setTelegramConfig(telegram: TelegramConfig): void {
  const config = loadConfig();
  config.telegram = telegram;
  saveConfig(config);
}

export function hasTelegramConfig(): boolean {
  const local = loadLocalConfig();
  if (local.telegram?.token) return true;
  if (process.env.TELEGRAM_BOT_TOKEN) return true;
  const telegram = loadConfig().telegram;
  return !!(telegram?.telegramToken);
}

export function clearTelegramConfig(): void {
  const config = loadConfig();
  delete config.telegram;
  saveConfig(config);
}

export function getTelegramAllowedChatIds(): string[] {
  return getTelegramConfig()?.allowedChatIds ?? [];
}

export function addTelegramAllowedChatId(chatId: string): void {
  const config = loadConfig();
  if (!config.telegram) return;
  const current = config.telegram.allowedChatIds ?? [];
  if (!current.includes(chatId)) {
    config.telegram.allowedChatIds = [...current, chatId];
    saveConfig(config);
  }
}

export function isTelegramChatAuthorized(chatId: string): boolean {
  const ids = getTelegramAllowedChatIds();
  if (ids.length === 0) return true;
  return ids.includes(chatId);
}

// --- Projects base path & auto-discovery ---

function expandHome(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return join(homedir(), p.slice(1));
  }
  return p;
}

/**
 * Get configured base paths for project auto-discovery.
 * Priority: local config > env var > legacy config.
 */
export function getProjectsBasePaths(): string[] {
  const local = loadLocalConfig();
  if (local.projectsBasePaths && local.projectsBasePaths.length > 0) {
    return local.projectsBasePaths.map(p => expandHome(p));
  }
  const envPaths = process.env.PROJECTS_BASE_PATH;
  if (envPaths) {
    return envPaths.split(':').map(p => expandHome(p.trim())).filter(p => p);
  }
  const config = loadConfig();
  return config.projectsBasePaths?.map(p => expandHome(p)) ?? [];
}

/**
 * Get the default opencode.json config path.
 * Priority: local config > env var > legacy config.
 */
export function getOpenCodeConfigPath(): string | undefined {
  const local = loadLocalConfig();
  if (local.openCodeConfigPath) return expandHome(local.openCodeConfigPath);
  const envPath = process.env.OPENCODE_CONFIG_PATH;
  if (envPath) return expandHome(envPath);
  const config = loadConfig();
  return config.openCodeConfigPath ? expandHome(config.openCodeConfigPath) : undefined;
}

/**
 * Scan base paths and return all subdirectories as project entries.
 * Skips files, hidden dirs, node_modules.
 */
export function discoverProjects(): { alias: string; path: string }[] {
  const basePaths = getProjectsBasePaths();
  const projects: { alias: string; path: string }[] = [];
  const seen = new Set<string>();

  for (const basePath of basePaths) {
    if (!existsSync(basePath)) continue;

    try {
      const entries = readdirSync(basePath);
      for (const entry of entries) {
        if (entry.startsWith('.') || entry === 'node_modules') continue;

        const fullPath = join(basePath, entry);
        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory() && !seen.has(entry)) {
            seen.add(entry);
            projects.push({ alias: entry, path: fullPath });
          }
        } catch {
          // skip
        }
      }
    } catch {
      // skip
    }
  }

  return projects.sort((a, b) => a.alias.localeCompare(b.alias));
}

/**
 * Ensure the default opencode.json is symlinked into a project directory.
 * Only symlinks if the project doesn't already have its own config.
 */
export function ensureOpenCodeConfig(projectPath: string): boolean {
  const defaultConfigPath = getOpenCodeConfigPath();
  if (!defaultConfigPath || !existsSync(defaultConfigPath)) return false;

  const targetPath = join(projectPath, 'opencode.json');

  if (existsSync(targetPath)) {
    try {
      const linkTarget = readlinkSync(targetPath);
      if (resolve(linkTarget) === resolve(defaultConfigPath)) {
        return true; // already correctly symlinked
      }
    } catch {
      return false; // not a symlink - project has its own config
    }
  }

  try {
    symlinkSync(resolve(defaultConfigPath), targetPath);
    return true;
  } catch (error) {
    console.error(`Failed to symlink opencode.json to ${projectPath}:`, error instanceof Error ? error.message : error);
    return false;
  }
}
