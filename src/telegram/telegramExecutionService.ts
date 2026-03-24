import { Api } from 'grammy';
import * as dataStore from '../services/dataStore.js';
import * as sessionManager from '../services/sessionManager.js';
import * as serveManager from '../services/serveManager.js';
import * as worktreeManager from '../services/worktreeManager.js';
import { SSEClient } from '../services/sseClient.js';
import { formatStreamingOutput, formatFinalOutput } from './telegramFormatter.js';
import { processNextInQueue } from './telegramQueueManager.js';
import { getProjectShortcutLabel, getModelShortcutLabel } from './telegramHandlers.js';
import type { MessageUsageInfo } from '../types/index.js';

/** Format token count with K/M suffix */
function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

/** Format usage stats with all meta info */
function formatUsageStats(
  usage: MessageUsageInfo,
  branchName: string,
  projectAlias: string,
  modelDisplay: string,
  threadId: string
): string {
  const t = usage.tokens;
  const lines: string[] = [];
  let tokenLine = `Tokens: ${formatTokens(t.input)} in / ${formatTokens(t.output)} out`;
  if (t.reasoning > 0) tokenLine += ` / ${formatTokens(t.reasoning)} reasoning`;
  lines.push(tokenLine);
  if (t.cache.read > 0 || t.cache.write > 0) {
    lines.push(`Cache: ${formatTokens(t.cache.read)} read / ${formatTokens(t.cache.write)} write`);
  }
  lines.push(`Cost: $${usage.cost.toFixed(2)}`);
  if (usage.duration) {
    lines.push(`Time: ${(usage.duration / 1000).toFixed(1)}s`);
  }
  const projectLabel = getProjectShortcutLabel(threadId, projectAlias);
  const modelLabel = getModelShortcutLabel(threadId, modelDisplay);
  lines.push(`${projectLabel} | Branch: ${branchName} | ${modelLabel}`);
  return lines.join('\n');
}

/**
 * Run a prompt against OpenCode via the Telegram bot.
 * This mirrors the Discord executionService but uses the Telegram Bot API.
 * 
 * @param api - Grammy Bot API instance
 * @param chatId - Telegram chat ID to send messages to
 * @param topicId - Telegram forum topic ID (message_thread_id), undefined for regular chats
 * @param threadId - Internal thread ID for session tracking (chatId or chatId:topicId)
 * @param prompt - The user's prompt text
 * @param parentChatId - The parent chat ID for project binding lookup
 */
export async function runPrompt(
  api: Api,
  chatId: number,
  topicId: number | undefined,
  threadId: string,
  prompt: string,
  parentChatId: string
): Promise<void> {
  const projectPath = dataStore.getChannelProjectPath(parentChatId);
  if (!projectPath) {
    await safeSend(api, chatId, topicId, 'No project bound to this chat. Use /use <alias> to set a project.');
    return;
  }

  let worktreeMapping = dataStore.getWorktreeMapping(threadId);

  // Auto-create worktree if enabled and no mapping exists for this thread
  if (!worktreeMapping) {
    const projectAlias = dataStore.getChannelBinding(parentChatId);
    if (projectAlias && dataStore.getProjectAutoWorktree(projectAlias)) {
      try {
        const branchName = worktreeManager.sanitizeBranchName(
          `auto/${threadId.slice(0, 8)}-${Date.now()}`
        );
        const worktreePath = await worktreeManager.createWorktree(projectPath, branchName);

        const newMapping = {
          threadId,
          branchName,
          worktreePath,
          projectPath,
          description: prompt.slice(0, 50) + (prompt.length > 50 ? '...' : ''),
          createdAt: Date.now()
        };
        dataStore.setWorktreeMapping(newMapping);
        worktreeMapping = newMapping;

        await safeSend(api, chatId, topicId,
          `Auto-Worktree: ${branchName}\nBranch: ${branchName}\nPath: ${worktreePath}`
        );
      } catch (error) {
        console.error('Auto-worktree creation failed:', error);
      }
    }
  }

  const effectivePath = worktreeMapping?.worktreePath ?? projectPath;
  const preferredModel = dataStore.getChannelModel(parentChatId);
  const modelDisplay = preferredModel ? `${preferredModel}` : 'default';
  const projectAlias = dataStore.getChannelBinding(parentChatId) ?? 'unknown';

  const branchName = worktreeMapping?.branchName ?? await worktreeManager.getCurrentBranch(effectivePath) ?? 'main';

  let streamMessageId: number | undefined;
  try {
    const msg = await api.sendMessage(chatId, '...', {
      message_thread_id: topicId,
    });
    streamMessageId = msg.message_id;
  } catch {
    return;
  }

  let port: number;
  let sessionId: string;
  let updateInterval: NodeJS.Timeout | null = null;
  let accumulatedText = '';
  let lastContent = '';
  let tick = 0;
  let promptSent = false;
  let hasSessionError = false;
  const spinner = ['|', '/', '-', '\\'];

  const updateStreamMessage = async (content: string): Promise<boolean> => {
    if (!streamMessageId) return false;
    try {
      await api.editMessageText(chatId, streamMessageId, content);
      return true;
    } catch (error) {
      // Telegram returns error if message content hasn't changed
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.includes('message is not modified')) return true;
      console.error('Failed to edit stream message:', errMsg);
      return false;
    }
  };

  try {
    port = await serveManager.spawnServe(effectivePath, preferredModel);

    await updateStreamMessage('Waiting for OpenCode server...');
    await serveManager.waitForReady(port, 30000, effectivePath, preferredModel);

    const settings = dataStore.getQueueSettings(threadId);

    // If fresh context is enabled, we always clear the session before starting
    if (settings.freshContext) {
      sessionManager.clearSessionForThread(threadId);
    }

    const existingSession = sessionManager.getSessionForThread(threadId);
    if (existingSession && existingSession.projectPath === effectivePath) {
      const isValid = await sessionManager.validateSession(port, existingSession.sessionId);
      if (isValid) {
        sessionId = existingSession.sessionId;
        sessionManager.updateSessionLastUsed(threadId);
      } else {
        sessionId = await sessionManager.createSession(port);
        sessionManager.setSessionForThread(threadId, sessionId, effectivePath, port);
      }
    } else {
      sessionId = await sessionManager.createSession(port);
      sessionManager.setSessionForThread(threadId, sessionId, effectivePath, port);
    }

    const sseClient = new SSEClient();
    sseClient.connect(`http://127.0.0.1:${port}`);
    sessionManager.setSseClient(threadId, sseClient);

    let lastUsage: MessageUsageInfo | null = null;

    sseClient.onPartUpdated((part) => {
      if (part.sessionID !== sessionId) return;
      accumulatedText = part.text;
    });

    sseClient.onMessageUsage((usage) => {
      if (usage.sessionID !== sessionId) return;
      lastUsage = usage;
    });

    sseClient.onSessionIdle((idleSessionId) => {
      if (idleSessionId !== sessionId) return;
      if (!promptSent) return;

      if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
      }

      (async () => {
        try {
          if (hasSessionError) {
            sseClient.disconnect();
            sessionManager.clearSseClient(threadId);
            return;
          }

          if (!accumulatedText.trim()) {
            await updateStreamMessage('No output received - the model may have encountered an issue.');
            await safeSend(api, chatId, topicId, 'No output received');
          } else {
            const result = formatFinalOutput(accumulatedText);

            const editSuccess = await updateStreamMessage(result.chunks[0]);

            const startIndex = editSuccess ? 1 : 0;
            for (let i = startIndex; i < result.chunks.length; i++) {
              await safeSend(api, chatId, topicId, result.chunks[i]);
            }

            // Send usage stats if visible
            const showStats = dataStore.isStatsVisible(threadId);
            if (showStats && lastUsage) {
              await safeSend(api, chatId, topicId,
                formatUsageStats(lastUsage, branchName, projectAlias, modelDisplay, threadId) + '\n/hide_stats to hide'
              );
            }
          }

          sseClient.disconnect();
          sessionManager.clearSseClient(threadId);

          await processNextInQueue(api, chatId, topicId, threadId, parentChatId);
        } catch (error) {
          console.error('Error in onSessionIdle:', error);
          await safeSend(api, chatId, topicId, 'An unexpected error occurred while processing the response.');
        }
      })();
    });

    sseClient.onSessionError((errorSessionId, errorInfo) => {
      if (errorSessionId !== sessionId) return;
      if (!promptSent) return;

      hasSessionError = true;

      if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
      }

      (async () => {
        try {
          const errorMsg = errorInfo.data?.message || errorInfo.name || 'Unknown error';

          await updateStreamMessage(`Error: ${errorMsg}`);

          sseClient.disconnect();
          sessionManager.clearSseClient(threadId);

          const settings = dataStore.getQueueSettings(threadId);
          if (settings.continueOnFailure) {
            await processNextInQueue(api, chatId, topicId, threadId, parentChatId);
          } else {
            dataStore.clearQueue(threadId);
            await safeSend(api, chatId, topicId, 'Execution failed. Queue cleared. Use /queue settings to change this behavior.');
          }
        } catch (error) {
          console.error('Error in onSessionError:', error);
          await safeSend(api, chatId, topicId, 'An unexpected error occurred while handling a session error.');
        }
      })();
    });

    sseClient.onError((error) => {
      if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
      }

      (async () => {
        try {
          await updateStreamMessage(`Connection error: ${error.message}`);

          sseClient.disconnect();
          sessionManager.clearSseClient(threadId);

          const settings = dataStore.getQueueSettings(threadId);
          if (settings.continueOnFailure) {
            await processNextInQueue(api, chatId, topicId, threadId, parentChatId);
          } else {
            dataStore.clearQueue(threadId);
            await safeSend(api, chatId, topicId, 'Execution failed. Queue cleared. Use /queue settings to change this behavior.');
          }
        } catch (handlerError) {
          console.error('Error in SSE onError handler:', handlerError);
          await safeSend(api, chatId, topicId, 'An unexpected connection error occurred.');
        }
      })();
    });

    updateInterval = setInterval(async () => {
      tick++;
      try {
        const formatted = formatStreamingOutput(accumulatedText);
        const spinnerChar = spinner[tick % spinner.length];
        const newContent = formatted || 'Processing...';

        if (newContent !== lastContent || tick % 3 === 0) {
          lastContent = newContent;
          await updateStreamMessage(`${spinnerChar} ${newContent}`);
        }
      } catch (error) {
        console.error('Error in stream update interval:', error instanceof Error ? error.message : error);
      }
    }, 2000); // 2s interval to avoid Telegram rate limits

    await updateStreamMessage('Sending prompt...');
    await sessionManager.sendPrompt(port, sessionId, prompt, preferredModel);
    promptSent = true;

  } catch (error) {
    if (updateInterval) {
      clearInterval(updateInterval);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await updateStreamMessage(`OpenCode execution failed: ${errorMessage}`);

    const client = sessionManager.getSseClient(threadId);
    if (client) {
      client.disconnect();
      sessionManager.clearSseClient(threadId);
    }

    const settings = dataStore.getQueueSettings(threadId);
    if (settings.continueOnFailure) {
      await processNextInQueue(api, chatId, topicId, threadId, parentChatId);
    } else {
      dataStore.clearQueue(threadId);
      await safeSend(api, chatId, topicId, 'Execution failed. Queue cleared.');
    }
  }
}

async function safeSend(api: Api, chatId: number, topicId: number | undefined, content: string): Promise<boolean> {
  try {
    await api.sendMessage(chatId, content, {
      message_thread_id: topicId,
    });
    return true;
  } catch (error) {
    console.error('Failed to send message:', error instanceof Error ? error.message : error);
    return false;
  }
}
