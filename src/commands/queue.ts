import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  ThreadChannel,
} from 'discord.js';
import * as dataStore from '../services/dataStore.js';
import { processNextInQueue } from '../services/queueManager.js';
import type { Command } from './index.js';

export const queue: Command = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Manage the job queue for this thread')
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List all pending prompts in the queue'),
    )
    .addSubcommand((sub) =>
      sub.setName('clear').setDescription('Clear all pending prompts in the queue'),
    )
    .addSubcommand((sub) =>
      sub.setName('pause').setDescription('Pause the queue (current job will finish)'),
    )
    .addSubcommand((sub) =>
      sub.setName('resume').setDescription('Resume the queue and start next task if idle'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('settings')
        .setDescription('Configure queue behavior')
        .addBooleanOption((opt) =>
          opt
            .setName('continue_on_failure')
            .setDescription('Whether to continue to next task if current one fails'),
        )
        .addBooleanOption((opt) =>
          opt
            .setName('fresh_context')
            .setDescription('Whether to clear AI conversation context between tasks'),
        ),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    const thread = interaction.channel;
    if (!thread?.isThread()) {
      await interaction.reply({
        content: '❌ This command can only be used in a thread.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const threadId = thread.id;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'list') {
      const q = dataStore.getQueue(threadId);
      if (q.length === 0) {
        await interaction.reply({
          content: '📭 The queue is empty.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const list = q
        .map((m, i) => `${i + 1}. ${m.prompt.slice(0, 100)}${m.prompt.length > 100 ? '...' : ''}`)
        .join('\n');
      const settings = dataStore.getQueueSettings(threadId);
      const status = settings.paused ? '⏸️ Paused' : '▶️ Running';

      await interaction.reply({
        content: `📋 **Queue Status**: ${status}\n\n**Pending Tasks**:\n${list}`,
        flags: MessageFlags.Ephemeral,
      });
    } else if (subcommand === 'clear') {
      dataStore.clearQueue(threadId);
      await interaction.reply({ content: '🗑️ Queue cleared.', flags: MessageFlags.Ephemeral });
    } else if (subcommand === 'pause') {
      dataStore.updateQueueSettings(threadId, { paused: true });
      await interaction.reply({
        content:
          "⏸️ Queue paused. Current job will finish, but next one won't start automatically.",
        flags: MessageFlags.Ephemeral,
      });
    } else if (subcommand === 'resume') {
      dataStore.updateQueueSettings(threadId, { paused: false });
      await interaction.reply({ content: '▶️ Queue resumed.', flags: MessageFlags.Ephemeral });

      // Try to trigger next if idle
      const parentChannelId = (thread as ThreadChannel).parentId;
      if (parentChannelId) {
        const sseClient = (await import('../services/sessionManager.js')).getSseClient(threadId);
        if (!sseClient || !sseClient.isConnected()) {
          await processNextInQueue(thread as any, threadId, parentChannelId);
        }
      }
    } else if (subcommand === 'settings') {
      const continueOnFailure = interaction.options.getBoolean('continue_on_failure');
      const freshContext = interaction.options.getBoolean('fresh_context');

      const updates: any = {};
      if (continueOnFailure !== null) updates.continueOnFailure = continueOnFailure;
      if (freshContext !== null) updates.freshContext = freshContext;

      if (Object.keys(updates).length > 0) {
        dataStore.updateQueueSettings(threadId, updates);
      }

      const settings = dataStore.getQueueSettings(threadId);
      await interaction.reply({
        content: `⚙️ **Queue Settings Updated**:\n- Continue on failure: \`${settings.continueOnFailure}\`\n- Fresh context: \`${settings.freshContext}\``,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
