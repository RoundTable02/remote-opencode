import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  ThreadChannel,
} from 'discord.js';
import * as dataStore from '../services/dataStore.js';
import type { Command } from './index.js';

export const code: Command = {
  data: new SlashCommandBuilder()
    .setName('code')
    .setDescription(
      'Toggle passthrough mode - send messages directly to OpenCode',
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    const channel = interaction.channel;

    if (!channel?.isThread()) {
      await interaction.reply({
        content: '❌ This command only works inside threads.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const threadId = channel.id;
    const parentChannelId = (channel as ThreadChannel).parentId;

    if (!parentChannelId) {
      await interaction.reply({
        content: '❌ Cannot determine parent channel.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const projectPath = dataStore.getChannelProjectPath(parentChannelId);
    if (!projectPath) {
      await interaction.reply({
        content:
          '❌ No project set for this channel. Use `/use <alias>` in the parent channel first.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const currentState = dataStore.isPassthroughEnabled(threadId);
    const newState = !currentState;

    dataStore.setPassthroughMode(threadId, newState, interaction.user.id);

    if (newState) {
      await interaction.reply({
        content:
          '✅ **Passthrough mode enabled** for this thread.\nYour messages will be sent directly to OpenCode.',
      });
    } else {
      await interaction.reply({
        content:
          '❌ **Passthrough mode disabled.**\nUse `/opencode prompt:"..."` to send commands.',
      });
    }
  },
};
