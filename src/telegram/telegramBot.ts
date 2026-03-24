import { Bot } from 'grammy';
import pc from 'picocolors';
import { getTelegramConfig } from '../services/configStore.js';
import { initializeProxySupport } from '../services/proxySupport.js';
import * as serveManager from '../services/serveManager.js';
import { getCachedModels } from '../commands/model.js';
import { setRunPromptFn } from './telegramQueueManager.js';
import { runPrompt } from './telegramExecutionService.js';
import {
  handleStart,
  handleHelp,
  handleListProjects,
  handleListProjectsClickable,
  handleSwitchProject,
  handleSwitchModel,
  handleListModels,
  handleListModelsClickable,
  handleVibeCoding,
  handleStopCoding,
  handleStatus,
  handleOpencode,
  handleSetpath,
  handleDiff,
  handleInterrupt,
  handleQueueList,
  handleQueueClear,
  handleWork,
  handleHideStats,
  handleShowStats,
  handleMessage,
} from './telegramHandlers.js';

export async function startTelegramBot(): Promise<void> {
  const config = getTelegramConfig();

  if (!config) {
    throw new Error('Telegram configuration not found. Run "remote-opencode configure" first.');
  }

  setRunPromptFn(runPrompt);

  const bot = new Bot(config.telegramToken);

  // Primary commands - the new UX
  bot.command('start', handleStart);
  bot.command('help', handleHelp);
  bot.command('vibe_coding', handleVibeCoding);
  bot.command('stop_coding', handleStopCoding);
  bot.command('list_projects', handleListProjects);
  bot.command('sps', handleListProjectsClickable); // clickable project shortcuts
  bot.command('switch_project', handleSwitchProject);
  bot.command('sp', handleSwitchProject);           // short alias for /switch_project
  bot.command('switch_model', handleSwitchModel);
  bot.command('list_models', handleListModels);
  bot.command('lm', handleListModelsClickable); // clickable shortcuts version
  bot.command('status', handleStatus);
  bot.command('diff', handleDiff);
  bot.command('interrupt', handleInterrupt);
  bot.command('queue_list', handleQueueList);
  bot.command('queue_clear', handleQueueClear);
  bot.command('hide_stats', handleHideStats);
  bot.command('show_stats', handleShowStats);

  // Legacy / power-user commands (still work)
  bot.command('opencode', handleOpencode);
  bot.command('setpath', handleSetpath);
  bot.command('work', handleWork);
  // Aliases for old names
  bot.command('projects', handleListProjects);
  bot.command('lp', handleListProjects);            // alias for /list_projects
  bot.command('use', handleSwitchProject);
  bot.command('code', handleVibeCoding);
  bot.command('model_list', handleListModels);
  bot.command('model_set', handleSwitchModel);
  bot.command('session_info', handleStatus);

  // /sp_<encoded> legacy shortcut + /sp1..N index shortcuts from /sps
  bot.hears(/^\/sp_\S+/, handleSwitchProject);
  bot.hears(/^\/sp\d+/, handleSwitchProject);

  // /sm1..N index shortcuts from /lm
  bot.hears(/^\/sm\d+/, handleSwitchModel);

  // Passthrough messages (vibe coding mode) + voice
  bot.on('message:text', handleMessage);
  bot.on('message:voice', handleMessage);

  bot.catch((err) => {
    console.error(pc.red(`Telegram bot error: ${err.message}`));
    console.error(err.stack);
  });

  function gracefulShutdown(signal: string) {
    console.log(pc.yellow(`\n${signal} received. Shutting down...`));
    serveManager.stopAll();
    bot.stop();
    process.exit(0);
  }

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  initializeProxySupport();
  try { getCachedModels(); } catch { }

  console.log(pc.dim('Starting Telegram bot...'));
  await bot.start({
    onStart: (botInfo) => {
      console.log(pc.green(`Ready! Logged in as ${pc.bold(`@${botInfo.username}`)}`));
    },
  });
}
