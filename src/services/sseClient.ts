import { EventSource } from 'eventsource';
import type { TextPart, SSEEvent, SessionErrorInfo, MessageUsageInfo } from '../types/index.js';
import { getAuthHeaders } from '../utils/authHelper.js';

type PartUpdatedCallback = (part: TextPart) => void;
type SessionIdleCallback = (sessionId: string) => void;
type SessionErrorCallback = (sessionId: string, error: SessionErrorInfo) => void;
type MessageUsageCallback = (usage: MessageUsageInfo) => void;
type ErrorCallback = (error: Error) => void;

export class SSEClient {
  private eventSource: EventSource | null = null;
  private partUpdatedCallbacks: PartUpdatedCallback[] = [];
  private sessionIdleCallbacks: SessionIdleCallback[] = [];
  private sessionErrorCallbacks: SessionErrorCallback[] = [];
  private messageUsageCallbacks: MessageUsageCallback[] = [];
  private errorCallbacks: ErrorCallback[] = [];

  connect(baseUrl: string): void {
    const url = `${baseUrl}/event`;
    const authHeaders = getAuthHeaders();

    // eventsource v4 supports a custom fetch function for auth
    this.eventSource = new EventSource(url, {
      fetch: (input: string | URL | Request, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        for (const [key, value] of Object.entries(authHeaders)) {
          headers.set(key, value);
        }
        return globalThis.fetch(input, { ...init, headers });
      },
    } as any);

    this.eventSource.addEventListener('message', (event: MessageEvent) => {
      try {
        const data: SSEEvent = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        this.handleError(new Error(`Failed to parse SSE event: ${error}`));
      }
    });

    this.eventSource.addEventListener('error', (error: Event) => {
      this.handleError(error instanceof Error ? error : new Error('SSE connection error'));
    });
  }

  onPartUpdated(callback: PartUpdatedCallback): void {
    this.partUpdatedCallbacks.push(callback);
  }

  onSessionIdle(callback: SessionIdleCallback): void {
    this.sessionIdleCallbacks.push(callback);
  }

  onSessionError(callback: SessionErrorCallback): void {
    this.sessionErrorCallbacks.push(callback);
  }

  onMessageUsage(callback: MessageUsageCallback): void {
    this.messageUsageCallbacks.push(callback);
  }

  onError(callback: ErrorCallback): void {
    this.errorCallbacks.push(callback);
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  isConnected(): boolean {
    return this.eventSource !== null && this.eventSource.readyState === EventSource.OPEN;
  }

  private handleMessage(event: SSEEvent): void {
    if (event.type === 'message.part.updated') {
      const part = (event.properties as any).part;
      if (part && part.type === 'text') {
        const textPart: TextPart = {
          id: part.id,
          sessionID: part.sessionID,
          messageID: part.messageID,
          text: part.text,
        };
        this.partUpdatedCallbacks.forEach((cb) => cb(textPart));
      }
    } else if (event.type === 'message.updated') {
      // Extract usage info from completed assistant messages
      const info = (event.properties as any).info;
      if (info?.role === 'assistant' && info?.tokens && info?.finish) {
        const usage: MessageUsageInfo = {
          sessionID: info.sessionID,
          messageID: info.id,
          cost: info.cost ?? 0,
          tokens: {
            total: info.tokens.total,
            input: info.tokens.input ?? 0,
            output: info.tokens.output ?? 0,
            reasoning: info.tokens.reasoning ?? 0,
            cache: {
              read: info.tokens.cache?.read ?? 0,
              write: info.tokens.cache?.write ?? 0,
            },
          },
          modelID: info.modelID,
          providerID: info.providerID,
        };
        if (info.time?.created && info.time?.completed) {
          usage.duration = info.time.completed - info.time.created;
        }
        this.messageUsageCallbacks.forEach((cb) => cb(usage));
      }
    } else if (event.type === 'session.idle') {
      const sessionID = (event.properties as any).sessionID;
      if (sessionID) {
        this.sessionIdleCallbacks.forEach((cb) => cb(sessionID));
      }
    } else if (event.type === 'session.error') {
      const sessionID = (event.properties as any).sessionID;
      const error = (event.properties as any).error as SessionErrorInfo | undefined;
      if (sessionID && error) {
        this.sessionErrorCallbacks.forEach((cb) => cb(sessionID, error));
      }
    }
  }

  private handleError(error: Error): void {
    this.errorCallbacks.forEach((cb) => cb(error));
  }
}
