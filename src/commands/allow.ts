import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  MessageFlags
} from 'discord.js';
import { 
  getAllowedUserIds, 
  addAllowedUserId, 
  removeAllowedUserId, 
  isAuthorized 
} from '../services/configStore.js';
import type { Command } from './index.js';

export const allow: Command = {
  data: new SlashCommandBuilder()
    .setName('allow')
    .setDescription('Manage the bot access allowlist')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a user to the allowlist')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('The user to allow')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a user from the allowlist')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('The user to remove')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Show all allowed users')) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    const currentList = getAllowedUserIds();

    if (currentList.length === 0) {
      await interaction.reply({
        content: '⚠️ No allowlist configured. Use `remote-opencode allow add <userId>` or `remote-opencode setup` to set up access control first.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (!isAuthorized(interaction.user.id)) {
      await interaction.reply({
        content: '🚫 You are not authorized to manage the allowlist.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'add') {
      const user = interaction.options.getUser('user', true);
      addAllowedUserId(user.id);
      await interaction.reply({
        content: `✅ <@${user.id}> has been added to the allowlist.`,
        flags: MessageFlags.Ephemeral
      });
    }
    else if (subcommand === 'remove') {
      const user = interaction.options.getUser('user', true);
      const removed = removeAllowedUserId(user.id);

      if (!removed) {
        const reason = currentList.length <= 1
          ? 'Cannot remove the last allowed user. Use CLI `remote-opencode allow reset` to disable restrictions.'
          : `<@${user.id}> is not on the allowlist.`;
        await interaction.reply({
          content: `❌ ${reason}`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      await interaction.reply({
        content: `✅ <@${user.id}> has been removed from the allowlist.`,
        flags: MessageFlags.Ephemeral
      });
    }
    else if (subcommand === 'list') {
      const userMentions = currentList.map(id => `• <@${id}>`).join('\n');
      await interaction.reply({
        content: `🔒 **Allowed Users** (${currentList.length}):\n${userMentions}`,
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
