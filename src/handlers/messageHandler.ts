import { 
  Message, 
  ThreadChannel
} from 'discord.js';
import * as dataStore from '../services/dataStore.js';
import { runPrompt } from '../services/executionService.js';
import { isBusy } from '../services/queueManager.js';
import { isAuthorized } from '../services/configStore.js';

export async function handleMessageCreate(message: Message): Promise<void> {
  if (message.author.bot) return;
  if (message.system) return;
  
  const channel = message.channel;
  if (!channel.isThread()) return;
  
  const threadId = channel.id;
  
  if (!dataStore.isPassthroughEnabled(threadId)) return;
  
  if (!isAuthorized(message.author.id)) return;
  
  const parentChannelId = (channel as ThreadChannel).parentId;
  if (!parentChannelId) return;
  
  const prompt = message.content.trim();
  if (!prompt) return;

  if (isBusy(threadId)) {
    dataStore.addToQueue(threadId, {
      prompt,
      userId: message.author.id,
      timestamp: Date.now()
    });
    await message.react('📥');
    return;
  }

  await runPrompt(channel, threadId, prompt, parentChannelId);
}
