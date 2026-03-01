import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as dataStore from '../services/dataStore.js';
import type { Command } from './index.js';

const execAsync = promisify(exec);

const MAX_LENGTH = 1900;
const CODE_BLOCK_OVERHEAD = 8; // ```diff\n...\n```

function formatDiff(raw: string): string {
  const maxContent = MAX_LENGTH - CODE_BLOCK_OVERHEAD;

  if (raw.length <= maxContent) {
    return '```diff\n' + raw + '\n```';
  }

  const truncated = '...(truncated)...\n\n' + raw.slice(-maxContent + 20);
  return '```diff\n' + truncated + '\n```';
}

export const diff: Command = {
  data: new SlashCommandBuilder()
    .setName('diff')
    .setDescription('Show git diff for the current project')
    .addStringOption(option =>
      option.setName('target')
        .setDescription('What to diff: unstaged (default), staged, or branch')
        .setRequired(false)
        .addChoices(
          { name: 'unstaged', value: 'unstaged' },
          { name: 'staged', value: 'staged' },
          { name: 'branch', value: 'branch' }
        )
    )
    .addBooleanOption(option =>
      option.setName('stat')
        .setDescription('Show summary stats only (--stat)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('base')
        .setDescription('Base branch for branch diff (default: main)')
        .setRequired(false)
    ) as SlashCommandBuilder,

  execute: async (interaction: any) => {
    const i = interaction as ChatInputCommandInteraction;
    const target = i.options.getString('target') ?? 'unstaged';
    const stat = i.options.getBoolean('stat') ?? false;
    const base = i.options.getString('base') ?? 'main';

    const channel = i.channel;
    if (!channel) {
      await i.reply({ content: '❌ Unknown channel.', flags: MessageFlags.Ephemeral });
      return;
    }

    // Resolve project path: worktree thread takes priority
    let projectPath: string | undefined;
    if (channel.isThread()) {
      const mapping = dataStore.getWorktreeMapping(i.channelId);
      if (mapping) {
        projectPath = mapping.worktreePath;
      } else {
        const parentId = (channel as any).parentId;
        if (parentId) {
          projectPath = dataStore.getChannelProjectPath(parentId);
        }
      }
    } else {
      projectPath = dataStore.getChannelProjectPath(i.channelId);
    }

    if (!projectPath) {
      await i.reply({
        content: '❌ No project bound to this channel. Use `/setpath` and `/use` first.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await i.deferReply();

    try {
      let gitArgs: string;
      switch (target) {
        case 'staged':
          gitArgs = 'git diff --cached';
          break;
        case 'branch':
          gitArgs = `git diff ${base}...HEAD`;
          break;
        default:
          gitArgs = 'git diff';
      }

      if (stat) {
        gitArgs += ' --stat';
      }

      const { stdout } = await execAsync(gitArgs, { cwd: projectPath });
      const output = stdout.trim();

      if (!output) {
        const targetLabel = target === 'branch' ? `branch (base: ${base})` : target;
        await i.editReply(`✅ No ${targetLabel} changes.`);
        return;
      }

      await i.editReply(formatDiff(output));
    } catch (error) {
      await i.editReply(`❌ Failed to get diff: ${(error as Error).message}`);
    }
  }
};
