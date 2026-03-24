import * as p from '@clack/prompts';
import pc from 'picocolors';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { loadLocalConfig, saveLocalConfig, getLocalConfigPath, type LocalConfig } from '../services/configStore.js';

function expandHome(path: string): string {
  if (path.startsWith('~/') || path === '~') {
    return join(homedir(), path.slice(1));
  }
  return path;
}

function validatePath(value: string): string | undefined {
  if (!value) return undefined; // optional
  const expanded = expandHome(value.trim());
  if (!existsSync(expanded)) return `Path does not exist: ${expanded}`;
  return undefined;
}

function validateToken(value: string): string | undefined {
  if (!value) return undefined; // optional
  if (value.length < 30) return 'Token looks too short';
  return undefined;
}

export async function runConfigureWizard(): Promise<void> {
  console.clear();

  p.intro(pc.bgCyan(pc.black(' remote-opencode configure ')));

  const existingPath = getLocalConfigPath();
  const existing = loadLocalConfig();
  const hasExisting = existingPath && Object.keys(existing).length > 0;

  if (hasExisting) {
    p.log.info(`Found existing config: ${pc.cyan(existingPath!)}`);
    const overwrite = await p.confirm({
      message: 'Reconfigure? (existing values shown as defaults)',
      initialValue: true,
    });
    if (p.isCancel(overwrite) || !overwrite) {
      p.outro('Configuration unchanged.');
      return;
    }
  }

  const config: LocalConfig = { ...existing };

  // --- Step 1: Projects Base Path ---
  p.note(
    `Set the base directory where your projects live.\n` +
    `All subdirectories will be auto-discovered as projects.\n\n` +
    `${pc.dim('Example: ~/IdeaProjects, ~/projects')}\n` +
    `${pc.dim('Multiple paths separated by commas.')}`,
    'Step 1: Projects Base Path'
  );

  const currentBasePaths = existing.projectsBasePaths?.join(', ') ?? '';
  const basePaths = await p.text({
    message: 'Projects base path(s):',
    placeholder: '~/IdeaProjects',
    defaultValue: currentBasePaths || undefined,
    initialValue: currentBasePaths,
    validate: (value) => {
      if (!value) return 'At least one base path is required';
      const paths = value.split(',').map(p => p.trim());
      for (const path of paths) {
        const expanded = expandHome(path);
        if (!existsSync(expanded)) return `Path does not exist: ${expanded}`;
      }
      return undefined;
    },
  });

  if (p.isCancel(basePaths)) {
    p.cancel('Configuration cancelled.');
    process.exit(0);
  }

  config.projectsBasePaths = (basePaths as string).split(',').map(p => p.trim());

  // --- Step 2: Default OpenCode Config ---
  p.note(
    `Path to a default opencode.json config file.\n` +
    `This will be symlinked into projects that don't have their own.\n\n` +
    `${pc.dim('Leave blank to skip (each project must have its own config).')}`,
    'Step 2: Default OpenCode Config'
  );

  const currentConfigPath = existing.openCodeConfigPath ?? '';
  const openCodeConfigPath = await p.text({
    message: 'Default opencode.json path:',
    placeholder: '~/IdeaProjects/opencode.json',
    defaultValue: currentConfigPath || undefined,
    initialValue: currentConfigPath,
    validate: (value) => {
      if (!value) return undefined;
      return validatePath(value);
    },
  });

  if (p.isCancel(openCodeConfigPath)) {
    p.cancel('Configuration cancelled.');
    process.exit(0);
  }

  if (openCodeConfigPath && (openCodeConfigPath as string).trim()) {
    config.openCodeConfigPath = (openCodeConfigPath as string).trim();
  } else {
    delete config.openCodeConfigPath;
  }

  // --- Step 3: Telegram ---
  const wantTelegram = await p.confirm({
    message: 'Configure Telegram bot?',
    initialValue: !!(existing.telegram?.token),
  });

  if (p.isCancel(wantTelegram)) {
    p.cancel('Configuration cancelled.');
    process.exit(0);
  }

  if (wantTelegram) {
    p.note(
      `Get your token from ${pc.bold('@BotFather')} on Telegram:\n` +
      `1. Open Telegram, search @BotFather\n` +
      `2. Send /newbot and follow instructions\n` +
      `3. Copy the token`,
      'Telegram Bot Token'
    );

    const currentToken = existing.telegram?.token ?? '';
    const maskedCurrent = currentToken
      ? currentToken.slice(0, 6) + '...' + currentToken.slice(-4)
      : '';

    const telegramToken = await p.password({
      message: maskedCurrent
        ? `Telegram Bot Token (current: ${maskedCurrent}):`
        : 'Telegram Bot Token:',
      validate: validateToken,
    });

    if (p.isCancel(telegramToken)) {
      p.cancel('Configuration cancelled.');
      process.exit(0);
    }

    if (telegramToken && (telegramToken as string).trim()) {
      if (!config.telegram) config.telegram = {};
      config.telegram.token = (telegramToken as string).trim();
    } else if (currentToken) {
      if (!config.telegram) config.telegram = {};
      config.telegram.token = currentToken;
    }

    // Chat ID restriction
    const currentChatIds = existing.telegram?.allowedChatIds?.join(', ') ?? '';
    const chatIds = await p.text({
      message: 'Restrict to chat IDs (comma-separated, blank = allow all):',
      placeholder: '-1001234567890',
      defaultValue: currentChatIds || undefined,
      initialValue: currentChatIds,
    });

    if (!p.isCancel(chatIds) && chatIds && (chatIds as string).trim()) {
      if (!config.telegram) config.telegram = {};
      config.telegram.allowedChatIds = (chatIds as string).split(',').map(s => s.trim()).filter(s => s);
    }
  }

  // --- Step 4: Discord (optional) ---
  const wantDiscord = await p.confirm({
    message: 'Configure Discord bot?',
    initialValue: !!(existing.discord?.token),
  });

  if (p.isCancel(wantDiscord)) {
    p.cancel('Configuration cancelled.');
    process.exit(0);
  }

  if (wantDiscord) {
    const discordToken = await p.password({
      message: 'Discord Bot Token:',
      validate: validateToken,
    });
    if (p.isCancel(discordToken)) { p.cancel('Cancelled.'); process.exit(0); }

    const clientId = await p.text({
      message: 'Discord Application (Client) ID:',
      placeholder: '1234567890123456789',
      initialValue: existing.discord?.clientId ?? '',
    });
    if (p.isCancel(clientId)) { p.cancel('Cancelled.'); process.exit(0); }

    const guildId = await p.text({
      message: 'Discord Guild (Server) ID:',
      placeholder: '1234567890123456789',
      initialValue: existing.discord?.guildId ?? '',
    });
    if (p.isCancel(guildId)) { p.cancel('Cancelled.'); process.exit(0); }

    config.discord = {
      token: ((discordToken as string) || existing.discord?.token || '').trim(),
      clientId: ((clientId as string) || '').trim(),
      guildId: ((guildId as string) || '').trim(),
    };
  }

  // --- Step 5: OpenAI (optional) ---
  const wantOpenAI = await p.confirm({
    message: 'Configure OpenAI API key? (for voice transcription)',
    initialValue: !!(existing.openaiApiKey),
  });

  if (!p.isCancel(wantOpenAI) && wantOpenAI) {
    const apiKey = await p.password({
      message: 'OpenAI API Key:',
    });
    if (!p.isCancel(apiKey) && apiKey && (apiKey as string).trim()) {
      config.openaiApiKey = (apiKey as string).trim();
    }
  }

  // --- Save ---
  const s = p.spinner();
  s.start('Saving configuration...');

  saveLocalConfig(config);

  s.stop('Configuration saved!');

  const savedPath = getLocalConfigPath();
  p.log.success(`Config written to: ${pc.cyan(savedPath!)}`);

  // Show summary
  const summaryLines: string[] = [];
  if (config.projectsBasePaths?.length) {
    summaryLines.push(`Projects base: ${config.projectsBasePaths.join(', ')}`);
  }
  if (config.openCodeConfigPath) {
    summaryLines.push(`OpenCode config: ${config.openCodeConfigPath}`);
  }
  if (config.telegram?.token) {
    summaryLines.push(`Telegram: configured`);
  }
  if (config.discord?.token) {
    summaryLines.push(`Discord: configured`);
  }

  if (summaryLines.length > 0) {
    p.note(summaryLines.join('\n'), 'Summary');
  }

  p.outro(pc.green('Done! Start your bot with: remote-opencode telegram start'));
}
