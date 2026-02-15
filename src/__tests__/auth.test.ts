import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/mock/home'),
}));

import {
  getAllowedUserIds,
  setAllowedUserIds,
  addAllowedUserId,
  removeAllowedUserId,
  isAuthorized,
  loadConfig,
} from '../services/configStore.js';

function mockConfigFile(config: Record<string, unknown>): void {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(readFileSync).mockReturnValue(JSON.stringify(config));
}

describe('auth allowlist', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAllowedUserIds', () => {
    it('should return empty array when no allowedUserIds configured', () => {
      mockConfigFile({ bot: { discordToken: 't', clientId: 'c', guildId: 'g' } });
      expect(getAllowedUserIds()).toEqual([]);
    });

    it('should return configured user IDs', () => {
      mockConfigFile({ allowedUserIds: ['111', '222'] });
      expect(getAllowedUserIds()).toEqual(['111', '222']);
    });
  });

  describe('isAuthorized', () => {
    it('should allow everyone when allowlist is empty', () => {
      mockConfigFile({});
      expect(isAuthorized('anyUserId')).toBe(true);
      expect(isAuthorized('anotherUser')).toBe(true);
    });

    it('should allow only listed users when allowlist is non-empty', () => {
      mockConfigFile({ allowedUserIds: ['111', '222'] });
      expect(isAuthorized('111')).toBe(true);
      expect(isAuthorized('222')).toBe(true);
      expect(isAuthorized('333')).toBe(false);
    });
  });

  describe('addAllowedUserId', () => {
    it('should add a user to the allowlist', () => {
      mockConfigFile({ allowedUserIds: ['111'] });

      addAllowedUserId('222');

      expect(writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"222"'),
        expect.objectContaining({ encoding: 'utf-8', mode: 0o600 })
      );
    });

    it('should not duplicate an existing user', () => {
      mockConfigFile({ allowedUserIds: ['111'] });

      addAllowedUserId('111');

      expect(writeFileSync).not.toHaveBeenCalled();
    });

    it('should create the array when adding first user', () => {
      mockConfigFile({});

      addAllowedUserId('111');

      const writtenData = JSON.parse(
        vi.mocked(writeFileSync).mock.calls[0][1] as string
      );
      expect(writtenData.allowedUserIds).toEqual(['111']);
    });
  });

  describe('removeAllowedUserId', () => {
    it('should remove a user from the allowlist', () => {
      mockConfigFile({ allowedUserIds: ['111', '222'] });

      const result = removeAllowedUserId('111');

      expect(result).toBe(true);
      const writtenData = JSON.parse(
        vi.mocked(writeFileSync).mock.calls[0][1] as string
      );
      expect(writtenData.allowedUserIds).toEqual(['222']);
    });

    it('should return false when user is not on the allowlist', () => {
      mockConfigFile({ allowedUserIds: ['111'] });
      expect(removeAllowedUserId('999')).toBe(false);
    });

    it('should not remove the last remaining user', () => {
      mockConfigFile({ allowedUserIds: ['111'] });

      const result = removeAllowedUserId('111');

      expect(result).toBe(false);
      expect(writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe('setAllowedUserIds', () => {
    it('should replace the entire allowlist', () => {
      mockConfigFile({ allowedUserIds: ['111'] });

      setAllowedUserIds(['333', '444']);

      const writtenData = JSON.parse(
        vi.mocked(writeFileSync).mock.calls[0][1] as string
      );
      expect(writtenData.allowedUserIds).toEqual(['333', '444']);
    });

    it('should clear the allowlist with empty array', () => {
      mockConfigFile({ allowedUserIds: ['111'] });

      setAllowedUserIds([]);

      const writtenData = JSON.parse(
        vi.mocked(writeFileSync).mock.calls[0][1] as string
      );
      expect(writtenData.allowedUserIds).toEqual([]);
    });
  });

  describe('config persistence', () => {
    it('should preserve existing config when modifying allowlist', () => {
      mockConfigFile({
        bot: { discordToken: 'tok', clientId: 'cid', guildId: 'gid' },
        allowedUserIds: ['111'],
      });

      addAllowedUserId('222');

      const writtenData = JSON.parse(
        vi.mocked(writeFileSync).mock.calls[0][1] as string
      );
      expect(writtenData.bot).toEqual({
        discordToken: 'tok',
        clientId: 'cid',
        guildId: 'gid',
      });
      expect(writtenData.allowedUserIds).toEqual(['111', '222']);
    });
  });
});
