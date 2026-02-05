import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockEventSourceInstance = {
  addEventListener: vi.fn(),
  close: vi.fn(),
  readyState: 1,
};

vi.mock('eventsource', () => {
  const EventSourceMock: any = vi.fn().mockImplementation(function () {
    return mockEventSourceInstance;
  });
  EventSourceMock.OPEN = 1;
  EventSourceMock.CLOSED = 2;
  EventSourceMock.CONNECTING = 0;

  return {
    EventSource: EventSourceMock,
  };
});

import { SSEClient } from '../services/sseClient.js';
import { EventSource } from 'eventsource';

const MockEventSource = EventSource as unknown as ReturnType<typeof vi.fn>;

describe('SSEClient', () => {
  let client: SSEClient;

  beforeEach(() => {
    mockEventSourceInstance.addEventListener = vi.fn();
    mockEventSourceInstance.close = vi.fn();
    mockEventSourceInstance.readyState = 1;
    MockEventSource.mockClear();
    client = new SSEClient();
  });

  afterEach(() => {
    client.disconnect();
  });

  describe('connect', () => {
    it('should connect to SSE endpoint', () => {
      client.connect('http://127.0.0.1:3000');

      expect(MockEventSource).toHaveBeenCalledWith('http://127.0.0.1:3000/event');
    });

    it('should set up message event listener', () => {
      client.connect('http://127.0.0.1:3000');

      expect(mockEventSourceInstance.addEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function),
      );
    });

    it('should set up error event listener', () => {
      client.connect('http://127.0.0.1:3000');

      expect(mockEventSourceInstance.addEventListener).toHaveBeenCalledWith(
        'error',
        expect.any(Function),
      );
    });
  });

  describe('onPartUpdated', () => {
    it('should trigger callback for text part updates', () => {
      const callback = vi.fn();
      client.connect('http://127.0.0.1:3000');
      client.onPartUpdated(callback);

      const messageHandler = mockEventSourceInstance.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'message',
      )?.[1];

      const event = {
        data: JSON.stringify({
          type: 'message.part.updated',
          properties: {
            part: {
              type: 'text',
              id: 'part-1',
              sessionID: 'session-1',
              messageID: 'msg-1',
              text: 'Hello, world!',
            },
          },
        }),
      };

      messageHandler(event);

      expect(callback).toHaveBeenCalledWith({
        id: 'part-1',
        sessionID: 'session-1',
        messageID: 'msg-1',
        text: 'Hello, world!',
      });
    });

    it('should not trigger callback for non-text parts', () => {
      const callback = vi.fn();
      client.connect('http://127.0.0.1:3000');
      client.onPartUpdated(callback);

      const messageHandler = mockEventSourceInstance.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'message',
      )?.[1];

      const event = {
        data: JSON.stringify({
          type: 'message.part.updated',
          properties: {
            part: {
              type: 'tool',
              id: 'part-1',
              sessionID: 'session-1',
              messageID: 'msg-1',
            },
          },
        }),
      };

      messageHandler(event);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should not trigger callback for non-part-updated events', () => {
      const callback = vi.fn();
      client.connect('http://127.0.0.1:3000');
      client.onPartUpdated(callback);

      const messageHandler = mockEventSourceInstance.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'message',
      )?.[1];

      const event = {
        data: JSON.stringify({
          type: 'other.event',
          properties: {},
        }),
      };

      messageHandler(event);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('onSessionIdle', () => {
    it('should trigger callback for session.idle events', () => {
      const callback = vi.fn();
      client.connect('http://127.0.0.1:3000');
      client.onSessionIdle(callback);

      const messageHandler = mockEventSourceInstance.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'message',
      )?.[1];

      const event = {
        data: JSON.stringify({
          type: 'session.idle',
          properties: {
            sessionID: 'session-1',
          },
        }),
      };

      messageHandler(event);

      expect(callback).toHaveBeenCalledWith('session-1');
    });

    it('should not trigger callback for non-idle events', () => {
      const callback = vi.fn();
      client.connect('http://127.0.0.1:3000');
      client.onSessionIdle(callback);

      const messageHandler = mockEventSourceInstance.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'message',
      )?.[1];

      const event = {
        data: JSON.stringify({
          type: 'other.event',
          properties: {},
        }),
      };

      messageHandler(event);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('onError', () => {
    it('should trigger callback on error', () => {
      const callback = vi.fn();
      client.connect('http://127.0.0.1:3000');
      client.onError(callback);

      const errorHandler = mockEventSourceInstance.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'error',
      )?.[1];

      const error = new Error('Connection failed');
      errorHandler(error);

      expect(callback).toHaveBeenCalledWith(error);
    });
  });

  describe('disconnect', () => {
    it('should close the connection', () => {
      client.connect('http://127.0.0.1:3000');
      client.disconnect();

      expect(mockEventSourceInstance.close).toHaveBeenCalled();
    });

    it('should handle disconnect when not connected', () => {
      expect(() => client.disconnect()).not.toThrow();
    });
  });

  describe('isConnected', () => {
    it('should return true when connected', () => {
      client.connect('http://127.0.0.1:3000');
      mockEventSourceInstance.readyState = 1;

      expect(client.isConnected()).toBe(true);
    });

    it('should return false when disconnected', () => {
      client.connect('http://127.0.0.1:3000');
      mockEventSourceInstance.readyState = 2;

      expect(client.isConnected()).toBe(false);
    });

    it('should return false when not initialized', () => {
      expect(client.isConnected()).toBe(false);
    });
  });
});
