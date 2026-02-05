import { Interaction, MessageFlags } from 'discord.js';
import { commands } from '../commands/index.js';
import { handleButton } from './buttonHandler.js';

export async function handleInteraction(interaction: Interaction) {
  if (interaction.isButton()) {
    try {
      await handleButton(interaction);
    } catch (error) {
      console.error('Error handling button:', error);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);

  if (!command) {
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing command ${interaction.commandName}:`, error);
    const content = '❌ An error occurred while executing the command.';

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral });
      }
    } catch (replyError) {
      console.error('Failed to send error response to user:', replyError);
    }
  }
}
