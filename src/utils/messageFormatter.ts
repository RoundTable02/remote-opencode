export function stripAnsi(text: string): string {
  return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
}

export interface SSEEvent {
  type: string;
  properties: {
    part?: {
      type: string;
      text?: string;
      id?: string;
    };
    sessionID?: string;
  };
}

export function parseSSEEvent(data: string): SSEEvent | null {
  try {
    return JSON.parse(data) as SSEEvent;
  } catch {
    return null;
  }
}

export function extractTextFromPart(part: any): string {
  if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
    return part.text;
  }
  return '';
}

export function accumulateText(current: string, newText: string): string {
  return current + newText;
}

interface OpenCodePart {
  text?: string;
  type?: string;
  reason?: string;
  cost?: number;
  tokens?: {
    input?: number;
    output?: number;
    reasoning?: number;
  };
}

interface OpenCodeEvent {
  type: string;
  part?: OpenCodePart;
}

export function parseOpenCodeOutput(buffer: string): string {
  const lines = buffer.split('\n').filter((line) => line.trim());
  const textParts: string[] = [];
  let lastFinish: OpenCodeEvent | null = null;

  for (const line of lines) {
    try {
      const event = JSON.parse(line) as OpenCodeEvent;

      switch (event.type) {
        case 'text':
          if (event.part?.text) {
            textParts.push(event.part.text);
          }
          break;

        case 'step_finish':
          lastFinish = event;
          break;
      }
    } catch {
      const cleaned = stripAnsi(line);
      if (cleaned.trim()) {
        textParts.push(cleaned);
      }
    }
  }

  let result = textParts.join('\n');

  if (lastFinish?.part?.tokens) {
    const tokens = lastFinish.part.tokens;
    const cost = lastFinish.part.cost;
    result += `\n\n---\n📊 Tokens: ${tokens.input?.toLocaleString() || 0} in / ${tokens.output?.toLocaleString() || 0} out`;
    if (cost !== undefined && cost > 0) {
      result += ` | 💰 $${cost.toFixed(4)}`;
    }
  }

  return result;
}

export function formatOutput(buffer: string, maxLength: number = 1900): string {
  const parsed = parseOpenCodeOutput(buffer);

  if (!parsed.trim()) {
    return '⏳ Processing...';
  }

  if (parsed.length <= maxLength) {
    return parsed;
  }

  return '...(truncated)...\n\n' + parsed.slice(-maxLength);
}
