import { parseOpenCodeOutput, stripAnsi } from '../utils/messageFormatter.js';

/**
 * Telegram message size limit.
 * Telegram allows up to 4096 characters per message.
 */
const TELEGRAM_MAX_LENGTH = 4000;

/**
 * Split text into chunks that fit within Telegram's message limit.
 * Splits on paragraph boundaries (double newline) when possible.
 */
function splitIntoChunks(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try to split at a paragraph boundary (double newline)
    let splitIndex = remaining.lastIndexOf('\n\n', maxLength);
    if (splitIndex <= 0 || splitIndex < maxLength * 0.3) {
      // Fallback: split at single newline
      splitIndex = remaining.lastIndexOf('\n', maxLength);
    }
    if (splitIndex <= 0 || splitIndex < maxLength * 0.3) {
      // Last resort: hard split at maxLength
      splitIndex = maxLength;
    }

    chunks.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex).replace(/^\n+/, '');
  }

  return chunks;
}

export interface TelegramFormattedResult {
  chunks: string[];
}

/**
 * Format streaming output for Telegram (truncated to fit single message).
 */
export function formatStreamingOutput(buffer: string, maxLength: number = TELEGRAM_MAX_LENGTH): string {
  const parsed = parseOpenCodeOutput(buffer);

  if (!parsed.trim()) {
    return 'Processing...';
  }

  if (parsed.length <= maxLength) {
    return parsed;
  }

  return '...(truncated)...\n\n' + parsed.slice(-maxLength);
}

/**
 * Format final output for Telegram, splitting into chunks if needed.
 */
export function formatFinalOutput(buffer: string): TelegramFormattedResult {
  const parsed = parseOpenCodeOutput(buffer);

  if (!parsed.trim()) {
    return { chunks: ['Processing...'] };
  }

  const chunks = splitIntoChunks(parsed, TELEGRAM_MAX_LENGTH);
  return { chunks };
}

/**
 * Build context header for Telegram messages.
 */
export function buildTelegramContextHeader(branchName: string, modelName: string): string {
  return `Branch: ${branchName} | Model: ${modelName}`;
}

/**
 * Escape special characters for Telegram MarkdownV2 format.
 */
export function escapeMarkdownV2(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}
