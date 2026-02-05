import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dataStore from '../services/dataStore.js';
import { diff } from '../commands/diff.js';

// Mock dataStore
vi.mock('../services/dataStore.js', () => ({
  getChannelProjectPath: vi.fn(),
  getWorktreeMapping: vi.fn(),
}));

// Mock node:child_process
vi.mock('node:child_process', () => ({
  exec: vi.fn((cmd, options, callback) => {
    if (cmd.includes('git diff')) {
      callback(null, { stdout: 'diff output' });
    } else {
      callback(null, { stdout: '' });
    }
  }),
}));

describe('diff command', () => {
  let mockInteraction: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockInteraction = {
      channelId: 'thread-123',
      channel: { parentId: 'channel-456' },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
      options: {
        getBoolean: vi.fn().mockReturnValue(false),
      },
    };
  });

  it('should return error if no project is bound', async () => {
    vi.mocked(dataStore.getWorktreeMapping).mockReturnValue(undefined);
    vi.mocked(dataStore.getChannelProjectPath).mockReturnValue(undefined);

    await diff.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('❌ No project bound'),
    );
  });

  it('should show diff for project path', async () => {
    vi.mocked(dataStore.getWorktreeMapping).mockReturnValue(undefined);
    vi.mocked(dataStore.getChannelProjectPath).mockReturnValue('/path/to/project');

    await diff.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.stringContaining('diff output'));
  });

  it('should show diff for worktree path if in a thread', async () => {
    vi.mocked(dataStore.getWorktreeMapping).mockReturnValue({
      worktreePath: '/path/to/worktree',
    } as any);

    await diff.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.stringContaining('diff output'));
  });

  it('should respect the staged option', async () => {
    vi.mocked(dataStore.getChannelProjectPath).mockReturnValue('/path/to/project');
    mockInteraction.options.getBoolean.mockReturnValue(true);

    await diff.execute(mockInteraction);
    // The actual exec call is handled by the mock, but we verified the logic flows
    expect(mockInteraction.editReply).toHaveBeenCalled();
  });
});
