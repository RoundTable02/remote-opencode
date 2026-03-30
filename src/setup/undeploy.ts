import { REST, Routes } from 'discord.js';
import { getBotConfig } from '../services/configStore.js';
import { initializeProxySupport } from '../services/proxySupport.js';
import pc from 'picocolors';

export async function undeployCommands(): Promise<void> {
  const config = getBotConfig();

  if (!config) {
    throw new Error('Bot configuration not found. Run setup first.');
  }

  const rest = new REST({ version: '10' }).setToken(config.discordToken);

  initializeProxySupport();
  console.log(pc.dim('Removing all slash commands...'));

  await rest.put(
    Routes.applicationGuildCommands(config.clientId, config.guildId),
    { body: [] }
  );

  console.log(pc.green('Successfully removed all slash commands.'));
}
