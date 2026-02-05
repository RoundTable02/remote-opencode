import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  ThreadChannel,
} from 'discord.js';
import * as dataStore from '../services/dataStore.js';
import { getOrCreateThread } from '../utils/threadHelper.js';
import type { Command } from './index.js';
import { runPrompt } from '../services/executionService.js';
import { isBusy } from '../services/queueManager.js';

function getParentChannelId(interaction: ChatInputCommandInteraction): string {
  const channel = interaction.channel;
  if (channel?.isThread()) {
    return (channel as ThreadChannel).parentId ?? interaction.channelId;
  }
  return interaction.channelId;
}

export const opencode: Command = {
  data: new SlashCommandBuilder()
    .setName('opencode')
    .setDescription('Send a command to OpenCode')
    .addStringOption((option) =>
      option.setName('prompt').setDescription('Prompt to send to OpenCode').setRequired(true),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    const prompt = interaction.options.getString('prompt', true);
    const channelId = getParentChannelId(interaction);
    const isInThread = interaction.channel?.isThread() ?? false;

    const projectPath = dataStore.getChannelProjectPath(channelId);
    if (!projectPath) {
      await interaction.reply({
        content: '❌ No project set for this channel. Use `/use <alias>` to set a project.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    let thread;
    try {
      if (isInThread && interaction.channel?.isThread()) {
        thread = interaction.channel;
      } else {
        thread = await getOrCreateThread(interaction, prompt);
      }
    } catch {
      await interaction.reply({
        content: '❌ Cannot create thread.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const threadId = thread.id;

    if (isBusy(threadId)) {
      dataStore.addToQueue(threadId, {
        prompt,
        userId: interaction.user.id,
        timestamp: Date.now(),
      });
      await interaction.reply({
        content: '📥 Prompt added to queue.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      content: `📌 **Prompt**: ${prompt}`,
    });

    await runPrompt(thread as any, threadId, prompt, channelId);
  },
};
