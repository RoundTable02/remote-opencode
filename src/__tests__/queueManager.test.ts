import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processNextInQueue, isBusy } from '../services/queueManager.js';
import * as dataStore from '../services/dataStore.js';
import * as executionService from '../services/executionService.js';
import * as sessionManager from '../services/sessionManager.js';

vi.mock('../services/dataStore.js');
vi.mock('../services/executionService.js');
vi.mock('../services/sessionManager.js');

describe('queueManager', () => {
  const threadId = 'thread-1';
  const parentId = 'channel-1';
  const mockChannel = {
    send: vi.fn().mockResolvedValue({})
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isBusy', () => {
    it('should return true if sseClient is connected', () => {
      vi.mocked(sessionManager.getSseClient).mockReturnValue({
        isConnected: () => true
      } as any);
      expect(isBusy(threadId)).toBe(true);
    });

    it('should return false if sseClient is not connected', () => {
      vi.mocked(sessionManager.getSseClient).mockReturnValue({
        isConnected: () => false
      } as any);
      expect(isBusy(threadId)).toBe(false);
    });

    it('should return false if sseClient is missing', () => {
      vi.mocked(sessionManager.getSseClient).mockReturnValue(undefined);
      expect(isBusy(threadId)).toBe(false);
    });
  });

  describe('processNextInQueue', () => {
    it('should do nothing if queue is paused', async () => {
      vi.mocked(dataStore.getQueueSettings).mockReturnValue({
        paused: true,
        continueOnFailure: false,
        freshContext: true
      });
      
      await processNextInQueue(mockChannel as any, threadId, parentId);
      
      expect(dataStore.popFromQueue).not.toHaveBeenCalled();
    });

    it('should pop and run next prompt if not paused', async () => {
      vi.mocked(dataStore.getQueueSettings).mockReturnValue({
        paused: false,
        continueOnFailure: false,
        freshContext: true
      });
      vi.mocked(dataStore.popFromQueue).mockReturnValue({
        prompt: 'test prompt',
        userId: 'user-1',
        timestamp: Date.now()
      });

      await processNextInQueue(mockChannel as any, threadId, parentId);

      expect(dataStore.popFromQueue).toHaveBeenCalledWith(threadId);
      expect(executionService.runPrompt).toHaveBeenCalledWith(
        mockChannel, 
        threadId, 
        'test prompt', 
        parentId
      );
    });

    it('should do nothing if queue is empty', async () => {
      vi.mocked(dataStore.getQueueSettings).mockReturnValue({
        paused: false,
        continueOnFailure: false,
        freshContext: true
      });
      vi.mocked(dataStore.popFromQueue).mockReturnValue(undefined);

      await processNextInQueue(mockChannel as any, threadId, parentId);

      expect(executionService.runPrompt).not.toHaveBeenCalled();
    });
  });
});
