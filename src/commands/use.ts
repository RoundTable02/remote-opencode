import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import * as dataStore from '../services/dataStore.js';

export const use = {
  data: new SlashCommandBuilder()
    .setName('use')
    .setDescription('Set the project for this channel')
    .addStringOption((option) =>
      option.setName('alias').setDescription('Project alias').setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const alias = interaction.options.getString('alias', true);
    const channelId = interaction.channelId;

    const project = dataStore.getProject(alias);
    if (!project) {
      await interaction.reply({
        content: `❌ Project '${alias}' not found. Use \`/projects\` to see registered projects.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    dataStore.setChannelBinding(channelId, alias);
    await interaction.reply(`✅ Using project '${alias}' in this channel`);
  },
};
