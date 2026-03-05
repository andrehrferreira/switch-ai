import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db', () => ({
  default: { isConnected: vi.fn(), getDb: vi.fn() },
}));

import databaseManager from '../db';
import {
  recordFailure,
  getBlacklistedModels,
  isModelBlacklisted,
  clearBlacklist,
  FAILURE_THRESHOLD,
} from '../learning';
import type { FailurePattern } from '../types';

const mockStatement = { run: vi.fn(), get: vi.fn(), all: vi.fn() };
const mockDb = { prepare: vi.fn().mockReturnValue(mockStatement) };

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.prepare.mockReturnValue(mockStatement);
  vi.mocked(databaseManager.getDb).mockReturnValue(mockDb as never);
});

describe('FAILURE_THRESHOLD', () => {
  it('is a positive number', () => {
    expect(FAILURE_THRESHOLD).toBeGreaterThan(0);
  });
});

describe('recordFailure', () => {
  it('returns early when DB not connected', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(false);
    recordFailure('test/model', 'code', 'timeout');
    expect(mockDb.prepare).not.toHaveBeenCalled();
  });

  it('inserts new failure pattern when none exists', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
    mockStatement.get.mockReturnValue(undefined);
    recordFailure('test/model', 'code', 'timeout');
    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO failure_patterns')
    );
    expect(mockStatement.run).toHaveBeenCalledWith('test/model', 'code', 'timeout');
  });

  it('increments count without blacklisting when below threshold', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
    const existing: FailurePattern = {
      id: 1,
      model: 'test/model',
      category: 'code',
      error_type: 'timeout',
      count: 1,
      blacklist_until: null,
    };
    mockStatement.get.mockReturnValue(existing);
    recordFailure('test/model', 'code', 'timeout');
    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE failure_patterns')
    );
    const runArgs = mockStatement.run.mock.calls[0];
    expect(runArgs[0]).toBe(2);
    expect(runArgs[1]).toBeNull();
    expect(runArgs[2]).toBe(1);
  });

  it('sets blacklist_until when count reaches threshold', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
    const existing: FailurePattern = {
      id: 2,
      model: 'test/model',
      category: 'code',
      error_type: 'quality_failure',
      count: FAILURE_THRESHOLD - 1,
      blacklist_until: null,
    };
    mockStatement.get.mockReturnValue(existing);
    recordFailure('test/model', 'code', 'quality_failure');
    const runArgs = mockStatement.run.mock.calls[0];
    expect(runArgs[0]).toBe(FAILURE_THRESHOLD);
    expect(runArgs[1]).not.toBeNull();
    expect(typeof runArgs[1]).toBe('string');
  });
});

describe('getBlacklistedModels', () => {
  it('returns empty array when DB not connected', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(false);
    expect(getBlacklistedModels()).toEqual([]);
  });

  it('returns blacklisted model IDs', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
    mockStatement.all.mockReturnValue([{ model: 'bad/model' }, { model: 'slow/model' }]);
    const result = getBlacklistedModels();
    expect(result).toEqual(['bad/model', 'slow/model']);
  });

  it('returns empty array when no blacklisted models', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
    mockStatement.all.mockReturnValue([]);
    expect(getBlacklistedModels()).toEqual([]);
  });
});

describe('isModelBlacklisted', () => {
  it('returns true when model is blacklisted', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
    mockStatement.all.mockReturnValue([{ model: 'bad/model' }]);
    expect(isModelBlacklisted('bad/model')).toBe(true);
  });

  it('returns false when model is not blacklisted', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
    mockStatement.all.mockReturnValue([{ model: 'other/model' }]);
    expect(isModelBlacklisted('good/model')).toBe(false);
  });
});

describe('clearBlacklist', () => {
  it('returns early when DB not connected', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(false);
    clearBlacklist();
    expect(mockDb.prepare).not.toHaveBeenCalled();
  });

  it('clears blacklist for specific model', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
    clearBlacklist('test/model');
    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('WHERE model = ?')
    );
    expect(mockStatement.run).toHaveBeenCalledWith('test/model');
  });

  it('clears all blacklists when no model specified', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
    clearBlacklist();
    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE failure_patterns SET blacklist_until = NULL')
    );
    expect(mockStatement.run).toHaveBeenCalledWith();
  });
});
