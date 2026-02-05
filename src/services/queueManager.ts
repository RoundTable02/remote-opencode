import { TextBasedChannel } from 'discord.js';
import * as dataStore from './dataStore.js';
import { runPrompt } from './executionService.js';
import * as sessionManager from './sessionManager.js';

export async function processNextInQueue(
  channel: TextBasedChannel,
  threadId: string,
  parentChannelId: string,
): Promise<void> {
  const settings = dataStore.getQueueSettings(threadId);
  if (settings.paused) return;

  const next = dataStore.popFromQueue(threadId);
  if (!next) return;

  // Visual indication that we are starting the next one
  if ('send' in channel) {
    await (channel as any).send(`🔄 **Queue**: Starting next task...\n> ${next.prompt}`);
  }

  await runPrompt(channel, threadId, next.prompt, parentChannelId);
}

export function isBusy(threadId: string): boolean {
  const sseClient = sessionManager.getSseClient(threadId);
  return !!(sseClient && sseClient.isConnected());
}
