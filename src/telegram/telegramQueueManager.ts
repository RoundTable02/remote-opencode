import { Api, type Context } from 'grammy';
import * as dataStore from '../services/dataStore.js';
import * as sessionManager from '../services/sessionManager.js';
import { transcribe } from '../services/voiceService.js';

// Re-export isBusy from shared logic
export function isBusy(threadId: string): boolean {
  const sseClient = sessionManager.getSseClient(threadId);
  return !!(sseClient && sseClient.isConnected());
}

// Forward declaration - will be set by telegramBot.ts to avoid circular imports
let _runPrompt: ((
  api: Api,
  chatId: number,
  topicId: number | undefined,
  threadId: string,
  prompt: string,
  parentChatId: string
) => Promise<void>) | null = null;

export function setRunPromptFn(fn: typeof _runPrompt): void {
  _runPrompt = fn;
}

export async function processNextInQueue(
  api: Api,
  chatId: number,
  topicId: number | undefined,
  threadId: string,
  parentChatId: string
): Promise<void> {
  const settings = dataStore.getQueueSettings(threadId);
  if (settings.paused) return;

  const next = dataStore.popFromQueue(threadId);
  if (!next) return;

  let prompt = next.prompt;

  // Handle queued voice messages - perform STT now that it's our turn
  if (!prompt && next.voiceAttachmentUrl) {
    try {
      prompt = await transcribe(next.voiceAttachmentUrl, next.voiceAttachmentSize);
      if (!prompt.trim()) {
        console.error('[Voice STT] Queued voice message transcription returned empty');
        await processNextInQueue(api, chatId, topicId, threadId, parentChatId);
        return;
      }
    } catch (error) {
      console.error('[Voice STT] Queued voice transcription failed:', error instanceof Error ? error.message : error);
      await processNextInQueue(api, chatId, topicId, threadId, parentChatId);
      return;
    }
  }

  if (!prompt) return;

  // Visual indication that we are starting the next one
  try {
    await api.sendMessage(chatId, `Queue: Starting next task...\n> ${prompt}`, {
      message_thread_id: topicId,
    });
  } catch (error) {
    console.error('Failed to send queue notification:', error);
  }

  if (_runPrompt) {
    await _runPrompt(api, chatId, topicId, threadId, prompt, parentChatId);
  }
}
