import { Collection, SlashCommandBuilder } from 'discord.js';
import { setpath } from './setpath.js';
import { projects } from './projects.js';
import { use } from './use.js';
import { opencode } from './opencode.js';
import { work } from './work.js';
import { code } from './code.js';

export interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: any) => Promise<void>;
}

export const commands = new Collection<string, Command>();
commands.set(setpath.data.name, setpath as Command);
commands.set(projects.data.name, projects as Command);
commands.set(use.data.name, use as Command);
commands.set(opencode.data.name, opencode);
commands.set(work.data.name, work);
commands.set(code.data.name, code);
