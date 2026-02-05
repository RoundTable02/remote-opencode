import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  ThreadChannel,
} from 'discord.js';
import { execSync } from 'node:child_process';
import * as dataStore from '../services/dataStore.js';
import type { Command } from './index.js';

function getEffectiveChannelId(interaction: ChatInputCommandInteraction): string {
  const channel = interaction.channel;
  if (channel?.isThread()) {
    return (channel as ThreadChannel).parentId ?? interaction.channelId;
  }
  return interaction.channelId;
}

export const model: Command = {
  data: new SlashCommandBuilder()
    .setName('model')
    .setDescription('Manage AI models for the current channel')
    .addSubcommand((subcommand) =>
      subcommand.setName('list').setDescription('List all available models'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set')
        .setDescription('Set the model to use in this channel')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('The model name (e.g., google/gemini-2.0-flash)')
            .setRequired(true),
        ),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'list') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const output = execSync('opencode models', { encoding: 'utf-8' });
        const models = output.split('\n').filter((m) => m.trim());

        if (models.length === 0) {
          await interaction.editReply('No models found.');
          return;
        }

        // Group models by provider
        const groups: Record<string, string[]> = {};
        for (const m of models) {
          const [provider] = m.split('/');
          if (!groups[provider]) groups[provider] = [];
          groups[provider].push(m);
        }

        let response = '### 🤖 Available Models\n\n';
        for (const [provider, providerModels] of Object.entries(groups)) {
          response += `**${provider}**\n`;
          // Limit to 10 models per provider to avoid hitting discord message limit
          const displayModels = providerModels.slice(0, 10);
          response += displayModels.map((m) => `• \`${m}\``).join('\n') + '\n';
          if (providerModels.length > 10) {
            response += `*...and ${providerModels.length - 10} more*\n`;
          }
          response += '\n';

          if (response.length > 1800) {
            await interaction.followUp({ content: response, flags: MessageFlags.Ephemeral });
            response = '';
          }
        }

        if (response) {
          await interaction.editReply(response);
        }
      } catch (error) {
        console.error('Failed to list models:', error);
        await interaction.editReply('❌ Failed to retrieve models from OpenCode CLI.');
      }
    } else if (subcommand === 'set') {
      const modelName = interaction.options.getString('name', true);
      const channelId = getEffectiveChannelId(interaction);

      const projectAlias = dataStore.getChannelBinding(channelId);
      if (!projectAlias) {
        await interaction.reply({
          content: '❌ No project bound to this channel. Use `/use <alias>` first.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      dataStore.setChannelModel(channelId, modelName);

      await interaction.reply({
        content: `✅ Model for this channel set to \`${modelName}\`.\nSubsequent commands will use this model.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
