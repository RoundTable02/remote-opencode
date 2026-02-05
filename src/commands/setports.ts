import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { setPortConfig } from '../services/configStore.js';

export const setports = {
  data: new SlashCommandBuilder()
    .setName('setports')
    .setDescription('Configure the port range for OpenCode server instances')
    .addIntegerOption((option) =>
      option.setName('min').setDescription('Minimum port number').setRequired(true),
    )
    .addIntegerOption((option) =>
      option.setName('max').setDescription('Maximum port number').setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const min = interaction.options.getInteger('min', true);
    const max = interaction.options.getInteger('max', true);

    if (min >= max) {
      await interaction.reply({
        content: '❌ Minimum port must be less than maximum port.',
        ephemeral: true,
      });
      return;
    }

    if (min < 1024 || max > 65535) {
      await interaction.reply({
        content: '❌ Ports must be between 1024 and 65535.',
        ephemeral: true,
      });
      return;
    }

    setPortConfig({ min, max });

    await interaction.reply(`✅ Port range updated: ${min}-${max}`);
  },
};
