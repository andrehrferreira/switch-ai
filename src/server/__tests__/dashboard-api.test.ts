import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../memory/db', () => {
  const stmtAll = vi.fn().mockReturnValue([]);
  const stmtGet = vi.fn().mockReturnValue({ count: 0, avg: null });
  const prepare = vi.fn().mockReturnValue({ all: stmtAll, get: stmtGet });
  return {
    default: {
      getDb: vi.fn().mockReturnValue({ prepare }),
      isConnected: vi.fn().mockReturnValue(true),
    },
  };
});

vi.mock('../../memory/analytics', () => ({
  getCostSummary: vi.fn().mockReturnValue({ totalRequests: 0, totalCost: 0, avgCostPerRequest: 0 }),
  getModelPerformance: vi.fn().mockReturnValue([]),
}));

vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

import databaseManager from '../../memory/db';
import { getCostSummary, getModelPerformance } from '../../memory/analytics';
import { execFile } from 'child_process';
import {
  apiStats,
  apiRequests,
  apiRequestsExport,
  apiModels,
  apiBlacklist,
  apiCategories,
  apiActivity,
  apiBackends,
} from '../dashboard-api';

type ExecFileCallback = (err: Error | null) => void;

function mockDb(prepareReturns: Record<string, { all?: unknown[]; get?: unknown }>) {
  const prepare = vi.fn().mockImplementation((sql: string) => {
    for (const [key, val] of Object.entries(prepareReturns)) {
      if (sql.includes(key)) {
        return {
          all: vi.fn().mockReturnValue(val.all ?? []),
          get: vi.fn().mockReturnValue(val.get ?? { count: 0 }),
        };
      }
    }
    return {
      all: vi.fn().mockReturnValue([]),
      get: vi.fn().mockReturnValue({ count: 0, avg: null }),
    };
  });
  vi.mocked(databaseManager.getDb).mockReturnValue({ prepare } as never);
}

describe('apiStats', () => {
  beforeEach(() => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
  });

  it('returns zeroed stats when database is not connected', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(false);
    const result = apiStats();
    expect(result).toEqual({
      totalRequests: 0,
      successRate: 0,
      avgLatencyMs: 0,
      totalCost: 0,
      avgCostPerRequest: 0,
      requestsPerMinute: 0,
    });
  });

  it('returns computed stats from database when connected', () => {
    vi.mocked(getCostSummary).mockReturnValue({
      totalRequests: 10,
      totalCost: 0.5,
      avgCostPerRequest: 0.05,
    });

    mockDb({
      "status = ?": { get: { count: 8 } },
      'AVG(latency_ms)': { get: { avg: 250.5 } },
      "datetime('now', '-1 minute')": { get: { count: 3 } },
    });

    const result = apiStats();
    expect(result.totalRequests).toBe(10);
    expect(result.successRate).toBe(80); // 8/10 * 100 = 80, rounded to 1 decimal
    expect(result.avgLatencyMs).toBe(251); // rounded
    expect(result.totalCost).toBe(0.5);
    expect(result.avgCostPerRequest).toBe(0.05);
    expect(result.requestsPerMinute).toBe(3);
  });

  it('handles zero total requests (avoids division by zero)', () => {
    vi.mocked(getCostSummary).mockReturnValue({
      totalRequests: 0,
      totalCost: 0,
      avgCostPerRequest: 0,
    });

    mockDb({
      "status = ?": { get: { count: 0 } },
      'AVG(latency_ms)': { get: { avg: null } },
      "datetime('now', '-1 minute')": { get: { count: 0 } },
    });

    const result = apiStats();
    expect(result.successRate).toBe(0);
    expect(result.avgLatencyMs).toBe(0);
  });
});

describe('apiRequests', () => {
  beforeEach(() => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
  });

  it('returns empty when not connected', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(false);
    const result = apiRequests();
    expect(result).toEqual({ rows: [], total: 0 });
  });

  it('returns rows and total with default limit/offset', () => {
    const rows = [{ id: 1, prompt: 'test', final_model: 'haiku', status: 'success' }];
    mockDb({
      'COUNT(*)': { get: { count: 1 } },
      'SELECT *': { all: rows },
    });

    const result = apiRequests();
    expect(result.total).toBe(1);
    expect(result.rows).toEqual(rows);
  });

  it('applies model filter', () => {
    mockDb({
      'COUNT(*)': { get: { count: 0 } },
      'SELECT *': { all: [] },
    });

    const result = apiRequests({ model: 'haiku' });
    expect(result).toEqual({ rows: [], total: 0 });
    // Verify prepare was called with LIKE condition
    const prepare = vi.mocked(databaseManager.getDb)().prepare;
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('final_model LIKE'));
  });

  it('applies status filter', () => {
    mockDb({
      'COUNT(*)': { get: { count: 0 } },
      'SELECT *': { all: [] },
    });

    apiRequests({ status: 'success' });
    const prepare = vi.mocked(databaseManager.getDb)().prepare;
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('status = ?'));
  });

  it('applies date range filters', () => {
    mockDb({
      'COUNT(*)': { get: { count: 0 } },
      'SELECT *': { all: [] },
    });

    apiRequests({ from: '2026-01-01', to: '2026-12-31' });
    const prepare = vi.mocked(databaseManager.getDb)().prepare;
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('timestamp >='));
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('timestamp <='));
  });

  it('applies search filter', () => {
    mockDb({
      'COUNT(*)': { get: { count: 0 } },
      'SELECT *': { all: [] },
    });

    apiRequests({ search: 'test query' });
    const prepare = vi.mocked(databaseManager.getDb)().prepare;
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('prompt LIKE'));
  });

  it('uses custom limit and offset', () => {
    mockDb({
      'COUNT(*)': { get: { count: 100 } },
      'SELECT *': { all: [{ id: 5 }] },
    });

    const result = apiRequests({ limit: 5, offset: 10 });
    expect(result.total).toBe(100);
    expect(result.rows).toEqual([{ id: 5 }]);
  });
});

describe('apiRequestsExport', () => {
  beforeEach(() => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
  });

  it('returns empty array string when not connected (json)', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(false);
    expect(apiRequestsExport({}, 'json')).toBe('[]');
  });

  it('returns empty string when not connected (csv)', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(false);
    expect(apiRequestsExport({}, 'csv')).toBe('');
  });

  it('exports as JSON', () => {
    const rows = [{ id: 1, model: 'haiku', status: 'success' }];
    mockDb({ 'SELECT *': { all: rows } });

    const result = apiRequestsExport({}, 'json');
    expect(JSON.parse(result)).toEqual(rows);
  });

  it('exports as CSV with headers', () => {
    const rows = [
      { id: 1, model: 'haiku', status: 'success' },
      { id: 2, model: 'sonnet', status: 'error' },
    ];
    mockDb({ 'SELECT *': { all: rows } });

    const result = apiRequestsExport({}, 'csv');
    const lines = result.split('\n');
    expect(lines[0]).toBe('id,model,status');
    expect(lines[1]).toBe('1,haiku,success');
    expect(lines[2]).toBe('2,sonnet,error');
  });

  it('escapes CSV values with commas', () => {
    const rows = [{ id: 1, prompt: 'hello, world' }];
    mockDb({ 'SELECT *': { all: rows } });

    const result = apiRequestsExport({}, 'csv');
    expect(result).toContain('"hello, world"');
  });

  it('escapes CSV values with quotes', () => {
    const rows = [{ id: 1, prompt: 'say "hello"' }];
    mockDb({ 'SELECT *': { all: rows } });

    const result = apiRequestsExport({}, 'csv');
    expect(result).toContain('"say ""hello"""');
  });

  it('escapes CSV values with newlines', () => {
    const rows = [{ id: 1, prompt: 'line1\nline2' }];
    mockDb({ 'SELECT *': { all: rows } });

    const result = apiRequestsExport({}, 'csv');
    expect(result).toContain('"line1\nline2"');
  });

  it('returns empty string for csv with no rows', () => {
    mockDb({ 'SELECT *': { all: [] } });
    const result = apiRequestsExport({}, 'csv');
    expect(result).toBe('');
  });

  it('applies filters to export', () => {
    mockDb({ 'SELECT *': { all: [] } });
    apiRequestsExport({ model: 'haiku', status: 'success', from: '2026-01-01', to: '2026-12-31' }, 'json');
    const prepare = vi.mocked(databaseManager.getDb)().prepare;
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('final_model LIKE'));
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('status = ?'));
  });

  it('handles null values in CSV export', () => {
    const rows = [{ id: 1, prompt: null }];
    mockDb({ 'SELECT *': { all: rows } });

    const result = apiRequestsExport({}, 'csv');
    const lines = result.split('\n');
    expect(lines[1]).toBe('1,');
  });
});

describe('apiModels', () => {
  it('returns empty array when not connected', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(false);
    expect(apiModels()).toEqual([]);
  });

  it('delegates to getModelPerformance', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
    const mockData = [{ model: 'haiku', success_rate: 95 }];
    vi.mocked(getModelPerformance).mockReturnValue(mockData as never);
    expect(apiModels()).toEqual(mockData);
  });
});

describe('apiBlacklist', () => {
  it('returns empty array when not connected', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(false);
    expect(apiBlacklist()).toEqual([]);
  });

  it('returns blacklisted models from database', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
    const blacklisted = [{ model: 'bad-model', blacklist_until: '2026-12-31' }];
    mockDb({ 'failure_patterns': { all: blacklisted } });

    const result = apiBlacklist();
    expect(result).toEqual(blacklisted);
  });
});

describe('apiCategories', () => {
  it('returns empty array when not connected', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(false);
    expect(apiCategories()).toEqual([]);
  });

  it('returns category aggregates from database', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
    const categories = [
      { category: 'code', count: 50, successRate: 92.5 },
      { category: 'docs', count: 20, successRate: 100 },
    ];
    mockDb({ 'GROUP BY category': { all: categories } });

    const result = apiCategories();
    expect(result).toEqual(categories);
  });
});

describe('apiActivity', () => {
  it('returns empty array when not connected', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(false);
    expect(apiActivity()).toEqual([]);
  });

  it('returns hourly activity from database', () => {
    vi.mocked(databaseManager.isConnected).mockReturnValue(true);
    const activity = [
      { hour: '10:00', count: 5 },
      { hour: '11:00', count: 8 },
    ];
    mockDb({ 'GROUP BY hour': { all: activity } });

    const result = apiActivity();
    expect(result).toEqual(activity);
  });
});

describe('apiBackends', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns backend availability list', async () => {
    // Mock all CLI tools as unavailable
    vi.mocked(execFile).mockImplementation((...args: unknown[]) => {
      const cb = args[args.length - 1] as ExecFileCallback;
      process.nextTick(() => cb(new Error('not found')));
      return {} as ReturnType<typeof execFile>;
    });
    // Ensure API keys are not set
    delete process.env['OPENROUTER_KEY'];
    delete process.env['GEMINI_API_KEY'];
    delete process.env['GOOGLE_API_KEY'];

    const result = await apiBackends();
    expect(result).toHaveLength(5);
    expect(result.map((b) => b.id)).toEqual([
      'claude-cli', 'gemini-cli', 'cursor-cli', 'gemini-api', 'openrouter',
    ]);
    // CLI and API backends should be unavailable
    expect(result.every((b) => !b.available)).toBe(true);
  });

  it('marks CLIs as available when found', async () => {
    vi.mocked(execFile).mockImplementation((...args: unknown[]) => {
      const cb = args[args.length - 1] as ExecFileCallback;
      process.nextTick(() => cb(null)); // success = found
      return {} as ReturnType<typeof execFile>;
    });

    const result = await apiBackends();
    expect(result[0].available).toBe(true); // claude
    expect(result[1].available).toBe(true); // gemini
    expect(result[2].available).toBe(true); // cursor-agent
  });

  it('marks OpenRouter as available when OPENROUTER_KEY is set', async () => {
    process.env['OPENROUTER_KEY'] = 'sk-test';
    vi.mocked(execFile).mockImplementation((...args: unknown[]) => {
      const cb = args[args.length - 1] as ExecFileCallback;
      process.nextTick(() => cb(new Error('not found')));
      return {} as ReturnType<typeof execFile>;
    });

    const result = await apiBackends();
    expect(result[4].id).toBe('openrouter');
    expect(result[4].available).toBe(true);
  });

  it('marks Gemini API as available when GEMINI_API_KEY is set', async () => {
    process.env['GEMINI_API_KEY'] = 'test-key';
    vi.mocked(execFile).mockImplementation((...args: unknown[]) => {
      const cb = args[args.length - 1] as ExecFileCallback;
      process.nextTick(() => cb(new Error('not found')));
      return {} as ReturnType<typeof execFile>;
    });

    const result = await apiBackends();
    expect(result[3].id).toBe('gemini-api');
    expect(result[3].available).toBe(true);
  });

  it('marks Gemini API as available when GOOGLE_API_KEY is set', async () => {
    process.env['GOOGLE_API_KEY'] = 'test-key';
    vi.mocked(execFile).mockImplementation((...args: unknown[]) => {
      const cb = args[args.length - 1] as ExecFileCallback;
      process.nextTick(() => cb(new Error('not found')));
      return {} as ReturnType<typeof execFile>;
    });

    const result = await apiBackends();
    expect(result[3].id).toBe('gemini-api');
    expect(result[3].available).toBe(true);
  });

  it('includes correct metadata for each backend', async () => {
    vi.mocked(execFile).mockImplementation((...args: unknown[]) => {
      const cb = args[args.length - 1] as ExecFileCallback;
      process.nextTick(() => cb(new Error('not found')));
      return {} as ReturnType<typeof execFile>;
    });

    const result = await apiBackends();
    const claude = result.find((b) => b.id === 'claude-cli')!;
    expect(claude.name).toBe('Claude CLI');
    expect(claude.type).toBe('cli');
    expect(claude.free).toBe(true);

    const openrouter = result.find((b) => b.id === 'openrouter')!;
    expect(openrouter.type).toBe('api');
    expect(openrouter.free).toBe(false);
  });
});
