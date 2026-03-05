import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db', () => ({
  default: { isConnected: vi.fn(), getDb: vi.fn() },
}));

import databaseManager from '../db';
import { recordRequest, updateModelPerformance } from '../recorder';
import type { ModelPerformance } from '../types';

const mockStatement = { run: vi.fn(), get: vi.fn(), all: vi.fn() };
const mockDb = { prepare: vi.fn().mockReturnValue(mockStatement) };

const baseData = {
  prompt: 'Write a sort function',
  initialModel: 'openai/gpt-4o',
  finalModel: 'anthropic/claude-haiku',
  category: 'code',
  complexityScore: 5,
  status: 'success' as const,
  latencyMs: 120,
  tokensInput: 50,
  tokensOutput: 80,
  cost: 0.001,
  validationPassed: true,
  escalations: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockStatement.get.mockReturnValue(undefined);
  mockDb.prepare.mockReturnValue(mockStatement);
  vi.mocked(databaseManager.getDb).mockReturnValue(mockDb as never);
});

describe('recordRequest', () => {
  it('returns empty string when DB not connected', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(false);
    const id = recordRequest(baseData);
    expect(id).toBe('');
    expect(mockDb.prepare).not.toHaveBeenCalled();
  });

  it('inserts request and returns UUID when connected', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
    const id = recordRequest(baseData);
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(mockDb.prepare).toHaveBeenCalled();
    expect(mockStatement.run).toHaveBeenCalled();
  });

  it('passes validationPassed=false as 0', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
    recordRequest({ ...baseData, validationPassed: false });
    const firstRunArgs = mockStatement.run.mock.calls[0];
    expect(firstRunArgs).toContain(0);
  });

  it('passes validationPassed=true as 1', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
    recordRequest({ ...baseData, validationPassed: true });
    const firstRunArgs = mockStatement.run.mock.calls[0];
    expect(firstRunArgs).toContain(1);
  });
});

describe('updateModelPerformance', () => {
  it('returns early when DB not connected', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(false);
    updateModelPerformance('test/model', 'code', true, 100, 0.01);
    expect(mockDb.prepare).not.toHaveBeenCalled();
  });

  it('inserts new record when none exists', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
    mockStatement.get.mockReturnValue(undefined);
    updateModelPerformance('test/model', 'code', true, 100, 0.01);
    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO model_performance')
    );
    expect(mockStatement.run).toHaveBeenCalled();
  });

  it('inserts with failure values when success=false', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
    mockStatement.get.mockReturnValue(undefined);
    updateModelPerformance('test/model', 'code', false, 200, 0.02);
    const insertArgs = mockStatement.run.mock.calls[0];
    expect(insertArgs).toContain(0); // successes = 0
    expect(insertArgs).toContain(1); // failures = 1
  });

  it('updates existing record on success', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
    const existing: ModelPerformance = {
      model: 'test/model',
      category: 'code',
      attempts: 4,
      successes: 3,
      failures: 1,
      success_rate: 0.75,
      avg_latency_ms: 100,
      avg_cost: 0.01,
      last_used: '2024-01-01',
    };
    mockStatement.get.mockReturnValue(existing);
    updateModelPerformance('test/model', 'code', true, 200, 0.02);
    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE model_performance')
    );
    expect(mockStatement.run).toHaveBeenCalled();
  });

  it('updates existing record on failure with null avg fields', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
    const existing: ModelPerformance = {
      model: 'test/model',
      category: 'code',
      attempts: 2,
      successes: 2,
      failures: 0,
      success_rate: 1.0,
      avg_latency_ms: null,
      avg_cost: null,
      last_used: null,
    };
    mockStatement.get.mockReturnValue(existing);
    updateModelPerformance('test/model', 'code', false, 50, 0.001);
    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE model_performance')
    );
  });
});
