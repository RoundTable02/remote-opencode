import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import * as dataStore from '../services/dataStore.js';

export const setpath = {
  data: new SlashCommandBuilder()
    .setName('setpath')
    .setDescription('Register a project path')
    .addStringOption((option) =>
      option.setName('alias').setDescription('Project alias').setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('path').setDescription('Project path').setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const alias = interaction.options.getString('alias', true);
    const path = interaction.options.getString('path', true);

    dataStore.addProject(alias, path);
    await interaction.reply(`✅ Project '${alias}' registered: ${path}`);
  },
};
