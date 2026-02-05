import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

vi.mock('node:net', () => ({
  Server: class MockServer extends EventEmitter {
    listen(_port: number, _callback?: () => void) {
      setImmediate(() => this.emit('listening'));
      return this;
    }
    close(callback?: () => void) {
      if (callback) {
        setImmediate(() => callback());
      }
      return this;
    }
  },
}));

vi.mock('../services/configStore.js', () => ({
  getPortConfig: vi.fn(),
}));

import * as serveManager from '../services/serveManager.js';
import { getPortConfig } from '../services/configStore.js';
import { spawn } from 'node:child_process';

const createMockProcess = (): ChildProcess => {
  const proc = new EventEmitter() as ChildProcess;
  Object.defineProperty(proc, 'pid', {
    value: Math.floor(Math.random() * 10000),
    writable: true,
  });
  proc.kill = vi.fn().mockReturnValue(true);
  proc.stdout = new EventEmitter() as any;
  proc.stderr = new EventEmitter() as any;
  return proc;
};

describe('serveManager', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    serveManager.stopAll();
  });

  describe('spawnServe', () => {
    it('should spawn opencode serve and return port', async () => {
      const mockProc = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc);

      const projectPath = '/test/project';
      const port = await serveManager.spawnServe(projectPath);

      expect(port).toBeGreaterThanOrEqual(14097);
      expect(port).toBeLessThanOrEqual(14200);
      expect(spawn).toHaveBeenCalledWith(
        'opencode',
        ['serve', '--port', port.toString()],
        expect.objectContaining({
          cwd: projectPath,
          shell: true,
        }),
      );
    });

    it('should return existing port if serve already running for project', async () => {
      const mockProc = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc);

      const projectPath = '/test/project';
      const port1 = await serveManager.spawnServe(projectPath);
      const port2 = await serveManager.spawnServe(projectPath);

      expect(port1).toBe(port2);
      expect(spawn).toHaveBeenCalledTimes(1);
    });

    it('should allocate different ports for different projects', async () => {
      vi.mocked(spawn).mockImplementation(() => createMockProcess());

      const port1 = await serveManager.spawnServe('/project1');
      const port2 = await serveManager.spawnServe('/project2');

      expect(port1).not.toBe(port2);
      expect(spawn).toHaveBeenCalledTimes(2);
    });

    it('should respect custom port range from config', async () => {
      vi.mocked(spawn).mockImplementation(() => createMockProcess());
      vi.mocked(getPortConfig).mockReturnValue({ min: 20000, max: 20010 });

      const port = await serveManager.spawnServe('/test/custom-port');

      expect(port).toBe(20000);
      expect(spawn).toHaveBeenCalledWith(
        'opencode',
        ['serve', '--port', '20000'],
        expect.anything(),
      );
    });

    it('should clean up when process exits', async () => {
      const mockProc = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc);

      const projectPath = '/test/project';
      await serveManager.spawnServe(projectPath);

      expect(serveManager.getPort(projectPath)).toBeDefined();

      mockProc.emit('exit', 0, null);

      // Wait for async exit handler
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Instance should still exist but be marked as exited
      const state = serveManager.getInstanceState(projectPath);
      expect(state?.exited).toBe(true);
      expect(state?.exitCode).toBe(0);
    });

    it('should track error message when process exits with non-zero code', async () => {
      const mockProc = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc);

      const projectPath = '/test/project';
      await serveManager.spawnServe(projectPath);

      // Simulate stderr output before exit
      mockProc.stderr?.emit('data', Buffer.from('Error: opencode command not found'));
      mockProc.emit('exit', 1, null);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const state = serveManager.getInstanceState(projectPath);
      expect(state?.exited).toBe(true);
      expect(state?.exitCode).toBe(1);
      expect(state?.exitError).toContain('opencode command not found');
    });

    it('should track error message when process fails to spawn', async () => {
      const mockProc = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc);

      const projectPath = '/test/project';
      await serveManager.spawnServe(projectPath);

      mockProc.emit('error', new Error('spawn opencode ENOENT'));

      await new Promise((resolve) => setTimeout(resolve, 10));

      const state = serveManager.getInstanceState(projectPath);
      expect(state?.exited).toBe(true);
      expect(state?.exitError).toContain('spawn opencode ENOENT');
    });

    it('should allow respawning after process exits', async () => {
      vi.mocked(spawn).mockImplementation(() => createMockProcess());

      const projectPath = '/test/project';
      const _port1 = await serveManager.spawnServe(projectPath);

      // Get the mock process and mark it as exited
      const mockProc1 = vi.mocked(spawn).mock.results[0].value;
      mockProc1.emit('exit', 1, null);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should spawn a new process
      const port2 = await serveManager.spawnServe(projectPath);

      expect(spawn).toHaveBeenCalledTimes(2);
      // Port might be the same or different depending on cleanup timing
      expect(port2).toBeGreaterThanOrEqual(14097);
    });
  });

  describe('getPort', () => {
    it('should return port for running serve', async () => {
      const mockProc = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc);

      const projectPath = '/test/project';
      const expectedPort = await serveManager.spawnServe(projectPath);

      const port = serveManager.getPort(projectPath);
      expect(port).toBe(expectedPort);
    });

    it('should return undefined for non-existent serve', () => {
      const port = serveManager.getPort('/non/existent');
      expect(port).toBeUndefined();
    });
  });

  describe('stopServe', () => {
    it('should stop serve and return true', async () => {
      const mockProc = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc);

      const projectPath = '/test/project';
      await serveManager.spawnServe(projectPath);

      const result = serveManager.stopServe(projectPath);

      expect(result).toBe(true);
      expect(mockProc.kill).toHaveBeenCalled();
      expect(serveManager.getPort(projectPath)).toBeUndefined();
    });

    it('should return false for non-existent serve', () => {
      const result = serveManager.stopServe('/non/existent');
      expect(result).toBe(false);
    });
  });

  describe('stopAll', () => {
    it('should stop all serve instances', async () => {
      const mockProc1 = createMockProcess();
      const mockProc2 = createMockProcess();
      vi.mocked(spawn).mockReturnValueOnce(mockProc1).mockReturnValueOnce(mockProc2);

      await serveManager.spawnServe('/project1');
      await serveManager.spawnServe('/project2');

      serveManager.stopAll();

      expect(mockProc1.kill).toHaveBeenCalled();
      expect(mockProc2.kill).toHaveBeenCalled();
      expect(serveManager.getPort('/project1')).toBeUndefined();
      expect(serveManager.getPort('/project2')).toBeUndefined();
    });

    it('should handle empty instances gracefully', () => {
      expect(() => serveManager.stopAll()).not.toThrow();
    });
  });

  describe('waitForReady', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    });

    it('should resolve when fetch returns ok', async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);

      const promise = serveManager.waitForReady(14097);

      await vi.runAllTimersAsync();

      await expect(promise).resolves.toBeUndefined();
      expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:14097/session');
    });

    it('should retry if fetch fails or returns not ok', async () => {
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockResolvedValueOnce({ ok: false } as Response)
        .mockResolvedValueOnce({ ok: true } as Response);

      const promise = serveManager.waitForReady(14097);

      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1000);

      await expect(promise).resolves.toBeUndefined();
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('should throw error on timeout', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Connection refused'));

      const promise = serveManager.waitForReady(14097, 1000);

      const wrappedPromise = expect(promise).rejects.toThrow(
        "Service at port 14097 failed to become ready within 1000ms. Check if 'opencode serve' is working correctly.",
      );

      await vi.advanceTimersByTimeAsync(1500);

      await wrappedPromise;
    });

    it('should fail fast when process exits early with error', async () => {
      vi.useRealTimers();
      vi.mocked(fetch).mockRejectedValue(new Error('Connection refused'));

      const mockProc = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc);

      const projectPath = '/test/fast-fail';
      const port = await serveManager.spawnServe(projectPath);

      // Simulate stderr output and immediate exit
      mockProc.stderr?.emit('data', Buffer.from('Error: Failed to bind to port'));
      mockProc.emit('exit', 1, null);

      // Wait for exit handler to process
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Now waitForReady should fail fast with the error message
      await expect(serveManager.waitForReady(port, 30000, projectPath)).rejects.toThrow(
        'opencode serve failed to start: Error: Failed to bind to port',
      );

      vi.useFakeTimers();
    });

    it('should still timeout if no projectPath provided and process exits', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Connection refused'));

      // Without projectPath, can't detect early exit
      const promise = serveManager.waitForReady(14097, 1000);

      const wrappedPromise = expect(promise).rejects.toThrow(
        'Service at port 14097 failed to become ready within 1000ms',
      );

      await vi.advanceTimersByTimeAsync(1500);

      await wrappedPromise;
    });
  });
});
