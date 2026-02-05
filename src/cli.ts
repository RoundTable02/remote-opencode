#!/usr/bin/env node
if (typeof process !== 'undefined') {
  // @ts-ignore
  process.removeAllListeners('warning');
}
// We also set the environment variable to suppress warnings in spawned processes
process.env.NODE_NO_WARNINGS = '1';
import { Command } from 'commander';
import pc from 'picocolors';
import { createRequire } from 'module';
import updateNotifier from 'update-notifier';
import { runSetupWizard } from './setup/wizard.js';
import { deployCommands } from './setup/deploy.js';
import { startBot } from './bot.js';
import { hasBotConfig, getConfigDir } from './services/configStore.js';

// Robust way to get package info that works in SEA
let pkg: any;
try {
  // Use a hardcoded version as primary fallback for bundled/SEA environments
  pkg = {
    name: 'remote-opencode',
    version: '1.2.0',
    description: 'Discord bot for remote OpenCode CLI access',
  };

  // Try to get real version if possible, but be extremely careful with import.meta.url
  const metaUrl =
    typeof import.meta !== 'undefined' && import.meta.url
      ? import.meta.url
      : 'file://' + process.execPath;
  const require = createRequire(metaUrl);
  const realPkg = require('../package.json');
  if (realPkg) pkg = realPkg;
} catch {
  // Fallback used
}

if (pkg && pkg.name) {
  try {
    updateNotifier({ pkg }).notify({ isGlobal: true });
  } catch {
    // Ignore notifier errors
  }
}

const program = new Command();

program
  .name('remote-opencode')
  .description('Discord bot for remote OpenCode CLI access')
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
  .command('config')
  .description('Show configuration info')
  .action(() => {
    console.log(pc.bold('\nConfiguration:'));
    console.log(`  Config directory: ${pc.cyan(getConfigDir())}`);
    console.log(`  Bot configured: ${hasBotConfig() ? pc.green('Yes') : pc.red('No')}`);
    console.log();
  });

program.action(async () => {
  if (!hasBotConfig()) {
    console.log(pc.bold('\nWelcome to remote-opencode!\n'));
    console.log('It looks like this is your first time running the bot.');
    console.log(`Run ${pc.cyan('remote-opencode setup')} to configure your Discord bot.\n`);
    console.log('Available commands:');
    console.log(`  ${pc.cyan('remote-opencode setup')}   - Interactive setup wizard`);
    console.log(`  ${pc.cyan('remote-opencode start')}   - Start the bot`);
    console.log(`  ${pc.cyan('remote-opencode deploy')}  - Deploy slash commands`);
    console.log(`  ${pc.cyan('remote-opencode config')}  - Show configuration`);
    console.log();
    process.exit(0);
  }

  await startBot();
});

program.parse();
