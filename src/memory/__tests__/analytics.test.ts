import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db', () => ({
  default: { isConnected: vi.fn(), getDb: vi.fn() },
}));

import databaseManager from '../db';
import { getModelPerformance, getCostSummary, getTopModels } from '../analytics';
import type { ModelPerformance } from '../types';

const mockStatement = { run: vi.fn(), get: vi.fn(), all: vi.fn() };
const mockDb = { prepare: vi.fn().mockReturnValue(mockStatement) };

const samplePerf: ModelPerformance = {
  model: 'test/model',
  category: 'code',
  attempts: 10,
  successes: 8,
  failures: 2,
  success_rate: 0.8,
  avg_latency_ms: 150,
  avg_cost: 0.005,
  last_used: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.prepare.mockReturnValue(mockStatement);
  mockStatement.all.mockReturnValue([samplePerf]);
  vi.mocked(databaseManager.getDb).mockReturnValue(mockDb as never);
});

describe('getModelPerformance', () => {
  it('returns empty array when DB not connected', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(false);
    expect(getModelPerformance()).toEqual([]);
  });

  it('returns all performance records when no filters', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
    const result = getModelPerformance();
    expect(result).toEqual([samplePerf]);
    expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('ORDER BY success_rate'));
  });

  it('filters by model only', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
    getModelPerformance('test/model');
    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('WHERE model = ?')
    );
  });

  it('filters by category only', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
    getModelPerformance(undefined, 'code');
    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('WHERE category = ?')
    );
  });

  it('filters by both model and category', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
    getModelPerformance('test/model', 'code');
    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('WHERE model = ? AND category = ?')
    );
  });
});

describe('getCostSummary', () => {
  it('returns zero summary when DB not connected', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(false);
    const result = getCostSummary();
    expect(result).toEqual({ totalRequests: 0, totalCost: 0, avgCostPerRequest: 0 });
  });

  it('returns aggregated cost data', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
    mockStatement.get.mockReturnValue({ count: 10, total: 0.5 });
    const result = getCostSummary();
    expect(result.totalRequests).toBe(10);
    expect(result.totalCost).toBe(0.5);
    expect(result.avgCostPerRequest).toBeCloseTo(0.05);
  });

  it('returns 0 avgCostPerRequest when no requests', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
    mockStatement.get.mockReturnValue({ count: 0, total: 0 });
    const result = getCostSummary();
    expect(result.avgCostPerRequest).toBe(0);
  });

  it('uses since parameter in query', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
    mockStatement.get.mockReturnValue({ count: 5, total: 0.25 });
    getCostSummary('2024-01-01T00:00:00Z');
    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('WHERE timestamp >=')
    );
  });
});

describe('getTopModels', () => {
  it('returns empty array when DB not connected', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(false);
    expect(getTopModels('code')).toEqual([]);
  });

  it('queries top models by category', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
    const result = getTopModels('code');
    expect(result).toEqual([samplePerf]);
    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY success_rate DESC')
    );
  });

  it('respects custom limit', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
    getTopModels('code', 3);
    const callArgs = mockStatement.all.mock.calls[0];
    expect(callArgs).toContain(3);
  });

  it('uses default limit of 5', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
    getTopModels('research');
    const callArgs = mockStatement.all.mock.calls[0];
    expect(callArgs).toContain(5);
  });
});
