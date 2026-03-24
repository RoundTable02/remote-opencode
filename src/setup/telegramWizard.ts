import * as p from '@clack/prompts';
import pc from 'picocolors';
import { setTelegramConfig, getTelegramConfig, hasTelegramConfig, addTelegramAllowedChatId } from '../services/configStore.js';

function validateToken(value: string): string | undefined {
  if (!value) return 'Bot token is required';
  if (value.length < 30) return 'Invalid token format (too short)';
  if (!value.includes(':')) return 'Invalid token format (must contain ":")';
  return undefined;
}

function validateChatId(value: string): string | undefined {
  if (!value) return undefined; // optional
  if (!/^-?\d+$/.test(value)) return 'Invalid chat ID (must be a number, can be negative for groups)';
  return undefined;
}

export async function runTelegramSetupWizard(): Promise<void> {
  console.clear();

  p.intro(pc.bgCyan(pc.black(' remote-opencode telegram setup ')));

  if (hasTelegramConfig()) {
    const existing = getTelegramConfig()!;
    const maskedToken = existing.telegramToken.slice(0, 6) + '...' + existing.telegramToken.slice(-4);
    const overwrite = await p.confirm({
      message: `Telegram bot already configured (Token: ${maskedToken}). Reconfigure?`,
      initialValue: false,
    });

    if (p.isCancel(overwrite) || !overwrite) {
      p.outro('Setup cancelled.');
      return;
    }
  }

  // Step 1: Create Bot via BotFather
  p.note(
    `To create a Telegram bot:\n\n` +
    `1. Open Telegram and search for ${pc.bold('@BotFather')}\n` +
    `2. Send ${pc.bold('/newbot')} and follow the instructions\n` +
    `3. Copy the ${pc.bold('Bot Token')} that BotFather gives you\n\n` +
    `${pc.dim('The token looks like: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz')}`,
    'Step 1: Create Telegram Bot'
  );

  const telegramToken = await p.password({
    message: 'Enter your Telegram Bot Token:',
    validate: validateToken,
  });

  if (p.isCancel(telegramToken)) {
    p.cancel('Setup cancelled.');
    process.exit(0);
  }

  // Step 2: Restrict to specific chats (optional)
  p.note(
    `You can restrict the bot to specific chats/groups.\n\n` +
    `To get a chat ID:\n` +
    `1. Add your bot to the group/chat\n` +
    `2. Send a message in the group\n` +
    `3. Visit: ${pc.cyan('https://api.telegram.org/bot<TOKEN>/getUpdates')}\n` +
    `4. Find the ${pc.bold('"chat":{"id":...')} in the JSON response\n\n` +
    `${pc.dim('Group IDs are negative numbers (e.g., -1001234567890)')}\n` +
    `${pc.dim('Leave blank to allow all chats')}`,
    'Step 2: Restrict Access (Optional)'
  );

  const chatId = await p.text({
    message: 'Enter a Chat ID to restrict access (leave blank for unrestricted):',
    placeholder: 'e.g., -1001234567890',
    defaultValue: '',
    validate: validateChatId,
  });

  if (p.isCancel(chatId)) {
    p.cancel('Setup cancelled.');
    process.exit(0);
  }

  // Save configuration
  const s = p.spinner();
  s.start('Saving configuration...');

  const telegramConfig: { telegramToken: string; allowedChatIds?: string[] } = {
    telegramToken: telegramToken as string,
  };

  if (chatId && (chatId as string).length > 0) {
    telegramConfig.allowedChatIds = [chatId as string];
  }

  setTelegramConfig(telegramConfig);

  s.stop('Configuration saved!');

  // Step 3: Set bot commands (guidance)
  p.note(
    `Your Telegram bot is configured!\n\n` +
    `Optionally, you can set up the command menu in BotFather:\n` +
    `1. Open ${pc.bold('@BotFather')} in Telegram\n` +
    `2. Send ${pc.bold('/setcommands')}\n` +
    `3. Select your bot\n` +
    `4. Send the following:\n\n` +
    `${pc.dim('start - Show welcome message')}\n` +
    `${pc.dim('help - Show available commands')}\n` +
    `${pc.dim('setpath - Register a project path')}\n` +
    `${pc.dim('projects - List registered projects')}\n` +
    `${pc.dim('use - Bind a project to this chat')}\n` +
    `${pc.dim('opencode - Send a prompt to OpenCode')}\n` +
    `${pc.dim('code - Toggle passthrough mode')}\n` +
    `${pc.dim('model_list - List available models')}\n` +
    `${pc.dim('model_set - Set model for this chat')}\n` +
    `${pc.dim('interrupt - Interrupt current task')}\n` +
    `${pc.dim('diff - Show git diff')}\n` +
    `${pc.dim('session_info - Show session info')}\n` +
    `${pc.dim('session_detach - Detach session')}\n` +
    `${pc.dim('queue_list - Show task queue')}\n` +
    `${pc.dim('queue_clear - Clear task queue')}`,
    'Step 3: Set Bot Commands (Optional)'
  );

  p.outro(pc.green('Setup complete! Run "remote-opencode telegram start" to start the Telegram bot.'));
}
