#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import { runSetupWizard } from './setup/wizard.js';
import { deployCommands } from './setup/deploy.js';
import { startBot } from './bot.js';
import { hasBotConfig, getConfigDir } from './services/configStore.js';

const program = new Command();

program
  .name('remote-opencode')
  .description('Discord bot for remote OpenCode CLI access')
  .version('1.0.0');

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

program
  .action(async () => {
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
