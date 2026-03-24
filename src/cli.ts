#!/usr/bin/env node
process.removeAllListeners('warning');
import 'dotenv/config';
import { Command } from 'commander';
import pc from 'picocolors';
import { createRequire } from 'module';
import updateNotifier from 'update-notifier';
import { runSetupWizard } from './setup/wizard.js';
import { runTelegramSetupWizard } from './setup/telegramWizard.js';
import { runConfigureWizard } from './setup/configureWizard.js';
import { deployCommands } from './setup/deploy.js';
import { startBot } from './bot.js';
import { startTelegramBot } from './telegram/telegramBot.js';
import { hasBotConfig, hasTelegramConfig, getConfigDir, getLocalConfigPath, getAllowedUserIds, addAllowedUserId, removeAllowedUserId, setAllowedUserIds, getOpenAIApiKey, setOpenAIApiKey, removeOpenAIApiKey, getProjectsBasePaths, getOpenCodeConfigPath } from './services/configStore.js';

const require = createRequire(import.meta.url);
// In dev mode (src/cli.ts), package.json is one level up
// In production (dist/src/cli.js), package.json is two levels up
const pkg = (() => {
  try {
    return require('../../package.json');
  } catch {
    return require('../package.json');
  }
})();

updateNotifier({ pkg }).notify({ isGlobal: true });

const program = new Command();

program
  .name('remote-opencode')
  .description('Discord & Telegram bot for remote OpenCode CLI access')
  .version(pkg.version);

program
  .command('start')
  .description('Start the Discord bot')
  .action(async () => {
    if (!hasBotConfig()) {
      console.log(pc.yellow('No bot configuration found.'));
      console.log(`Run ${pc.cyan('remote-opencode setup')} first to configure your Discord bot.\n`);
      process.exit(1);
    }
    
    try {
      await deployCommands();
    } catch {
      console.log(pc.dim('Command deployment skipped (will retry on next start)'));
    }
    
    await startBot();
  });

program
  .command('setup')
  .description('Interactive setup wizard for Discord bot configuration')
  .action(async () => {
    await runSetupWizard();
  });

program
  .command('deploy')
  .description('Deploy slash commands to Discord')
  .action(async () => {
    if (!hasBotConfig()) {
      console.log(pc.yellow('No bot configuration found.'));
      console.log(`Run ${pc.cyan('remote-opencode setup')} first.\n`);
      process.exit(1);
    }
    
    await deployCommands();
  });

program
  .command('configure')
  .description('Interactive configuration wizard for all settings')
  .action(async () => {
    await runConfigureWizard();
  });

program
  .command('config')
  .description('Show configuration info')
  .action(() => {
    console.log(pc.bold('\nConfiguration:'));
    const localPath = getLocalConfigPath();
    if (localPath) {
      console.log(`  Local config:     ${pc.cyan(localPath)}`);
    }
    console.log(`  Legacy config:    ${pc.cyan(getConfigDir())}`);
    console.log(`  Discord:          ${hasBotConfig() ? pc.green('configured') : pc.dim('not configured')}`);
    console.log(`  Telegram:         ${hasTelegramConfig() ? pc.green('configured') : pc.dim('not configured')}`);
    const basePaths = getProjectsBasePaths();
    if (basePaths.length > 0) {
      console.log(`  Projects base:    ${pc.cyan(basePaths.join(', '))}`);
    } else {
      console.log(`  Projects base:    ${pc.dim('not configured')}`);
    }
    const ocConfig = getOpenCodeConfigPath();
    if (ocConfig) {
      console.log(`  OpenCode config:  ${pc.cyan(ocConfig)}`);
    }
    console.log();
  });

const allowCmd = program.command('allow').description('Manage the bot access allowlist');

allowCmd
  .command('add <userId>')
  .description('Add a user to the allowlist')
  .action((userId: string) => {
    if (!/^\d{17,20}$/.test(userId)) {
      console.log(pc.red('❌ Invalid user ID. Must be a Discord snowflake (17-20 digits).'));
      process.exit(1);
    }
    addAllowedUserId(userId);
    console.log(pc.green(`✅ User ${userId} added to allowlist.`));
  });

allowCmd
  .command('remove <userId>')
  .description('Remove a user from the allowlist')
  .action((userId: string) => {
    const result = removeAllowedUserId(userId);
    if (result) {
      console.log(pc.green(`✅ User ${userId} removed from allowlist.`));
    } else {
      const ids = getAllowedUserIds();
      if (ids.length <= 1) {
        console.log(pc.red('❌ Cannot remove the last allowed user. Use "allow reset" to disable restrictions.'));
      } else {
        console.log(pc.red(`❌ User ${userId} is not on the allowlist.`));
      }
    }
  });

allowCmd
  .command('list')
  .description('Show all allowed users')
  .action(() => {
    const ids = getAllowedUserIds();
    if (ids.length === 0) {
      console.log(pc.yellow('🔓 No restrictions — all server members can use this bot.'));
    } else {
      console.log(pc.bold(`🔒 Allowed Users (${ids.length}):`));
      ids.forEach(id => console.log(`  • ${id}`));
    }
  });

allowCmd
  .command('reset')
  .description('Clear the allowlist (unrestricted mode)')
  .action(() => {
    setAllowedUserIds([]);
    console.log(pc.green('✅ Allowlist cleared. All server members can now use the bot.'));
  });

const voiceCmd = program.command('voice').description('Manage voice transcription settings');

voiceCmd
  .command('set <apiKey>')
  .description('Set OpenAI API key for voice transcription')
  .action((apiKey: string) => {
    if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
      console.log(pc.red('❌ Invalid API key format. Must start with "sk-" and be at least 20 characters.'));
      process.exit(1);
    }
    setOpenAIApiKey(apiKey);
    console.log(pc.green('✅ OpenAI API key set. Voice transcription is now enabled.'));
  });

voiceCmd
  .command('remove')
  .description('Remove OpenAI API key')
  .action(() => {
    removeOpenAIApiKey();
    console.log(pc.green('✅ OpenAI API key removed. Voice transcription is now disabled.'));
  });

voiceCmd
  .command('status')
  .description('Show voice transcription status')
  .action(() => {
    const envKey = process.env.OPENAI_API_KEY;
    const configKey = getOpenAIApiKey();
    if (!configKey) {
      console.log(pc.yellow('🎙️ Voice Transcription: Disabled'));
      console.log('  No OpenAI API key configured.');
    } else {
      const source = envKey ? 'environment variable' : 'config file';
      const masked = configKey.slice(0, 3) + '...' + configKey.slice(-6);
      console.log(pc.green('🎙️ Voice Transcription: Enabled'));
      console.log(`  Source: ${source}`);
      console.log(`  API Key: ${masked}`);
    }
  });

// Telegram commands
const telegramCmd = program.command('telegram').description('Manage the Telegram bot');

telegramCmd
  .command('start')
  .description('Start the Telegram bot')
  .action(async () => {
    if (!hasTelegramConfig()) {
      console.log(pc.yellow('No Telegram bot configuration found.'));
      console.log(`Run ${pc.cyan('remote-opencode telegram setup')} first to configure your Telegram bot.\n`);
      process.exit(1);
    }

    await startTelegramBot();
  });

telegramCmd
  .command('setup')
  .description('Interactive setup wizard for Telegram bot configuration')
  .action(async () => {
    await runTelegramSetupWizard();
  });

telegramCmd
  .command('config')
  .description('Show Telegram configuration info')
  .action(() => {
    console.log(pc.bold('\nTelegram Configuration:'));
    console.log(`  Config directory: ${pc.cyan(getConfigDir())}`);
    console.log(`  Telegram bot configured: ${hasTelegramConfig() ? pc.green('Yes') : pc.red('No')}`);
    console.log();
  });

program
  .action(async () => {
    if (!hasBotConfig() && !hasTelegramConfig()) {
      console.log(pc.bold('\nWelcome to remote-opencode!\n'));
      console.log('It looks like this is your first time running the bot.');
      console.log(`Run ${pc.cyan('remote-opencode configure')} to set up everything in one go.\n`);
      console.log('Available commands:');
      console.log(`  ${pc.cyan('remote-opencode configure')}         - Interactive config wizard (recommended)`);
      console.log(`  ${pc.cyan('remote-opencode setup')}             - Discord-only setup wizard`);
      console.log(`  ${pc.cyan('remote-opencode start')}             - Start the Discord bot`);
      console.log(`  ${pc.cyan('remote-opencode telegram start')}    - Start the Telegram bot`);
      console.log(`  ${pc.cyan('remote-opencode config')}            - Show configuration`);
      console.log();
      process.exit(0);
    }
    
    if (hasBotConfig()) {
      await startBot();
    } else if (hasTelegramConfig()) {
      console.log(pc.yellow('No Discord config found, but Telegram is configured.'));
      console.log(`Run ${pc.cyan('remote-opencode telegram start')} to start the Telegram bot.\n`);
      process.exit(0);
    }
  });

program.parse();
