import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { getChannelProjectPath } from '../services/dataStore.js';
import { getWorktreeMapping } from '../services/dataStore.js';

const execAsync = promisify(exec);

export const diff = {
  data: new SlashCommandBuilder()
    .setName('diff')
    .setDescription('Show current changes in the project')
    .addBooleanOption((option) =>
      option.setName('staged').setDescription('Show only staged changes').setRequired(false),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const threadId = interaction.channelId;
    const parentChannelId = (interaction.channel as any)?.parentId || threadId;

    const worktreeMapping = getWorktreeMapping(threadId);
    const projectPath = worktreeMapping?.worktreePath || getChannelProjectPath(parentChannelId);

    if (!projectPath) {
      await interaction.editReply('❌ No project bound to this channel.');
      return;
    }

    const showStaged = interaction.options.getBoolean('staged') ?? false;
    const gitCmd = showStaged ? 'git diff --staged' : 'git diff HEAD';

    try {
      const { stdout } = await execAsync(gitCmd, { cwd: projectPath });

      if (!stdout || stdout.trim().length === 0) {
        await interaction.editReply('✅ No changes found.');
        return;
      }

      // Truncate if too long for Discord (2000 chars total, leave room for formatting)
      let output = stdout.trim();
      const maxLength = 1900;
      if (output.length > maxLength) {
        output = output.slice(0, maxLength) + '\n... (truncated)';
      }

      await interaction.editReply(`\`\`\`diff\n${output}\n\`\`\``);
    } catch (error) {
      console.error('Diff error:', error);
      await interaction.editReply(
        `❌ Failed to get diff: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  },
};
