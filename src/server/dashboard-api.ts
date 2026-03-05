import { execFile } from 'child_process';
import databaseManager from '../memory/db';
import { getCostSummary, getModelPerformance } from '../memory/analytics';

function db() {
  return databaseManager.getDb();
}

function connected(): boolean {
  return databaseManager.isConnected();
}

export function apiStats() {
  if (!connected()) return { totalRequests: 0, successRate: 0, avgLatencyMs: 0, totalCost: 0, avgCostPerRequest: 0, requestsPerMinute: 0 };

  const summary = getCostSummary();
  const row = db()
    .prepare('SELECT COUNT(*) as count FROM requests WHERE status = ?')
    .get('success') as { count: number };

  const successRate = summary.totalRequests > 0 ? row.count / summary.totalRequests : 0;

  const latRow = db()
    .prepare('SELECT AVG(latency_ms) as avg FROM requests WHERE latency_ms IS NOT NULL')
    .get() as { avg: number | null };

  const recent = db()
    .prepare("SELECT COUNT(*) as count FROM requests WHERE timestamp >= datetime('now', '-1 minute')")
    .get() as { count: number };

  return {
    totalRequests: summary.totalRequests,
    successRate: Math.round(successRate * 1000) / 10,
    avgLatencyMs: Math.round(latRow.avg ?? 0),
    totalCost: summary.totalCost,
    avgCostPerRequest: summary.avgCostPerRequest,
    requestsPerMinute: recent.count,
  };
}

export interface RequestsFilter {
  limit?: number;
  offset?: number;
  model?: string;
  status?: string;
  from?: string;
  to?: string;
  search?: string;
}

export function apiRequests(filter: RequestsFilter = {}) {
  if (!connected()) return { rows: [], total: 0 };

  const limit = filter.limit ?? 20;
  const offset = filter.offset ?? 0;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.model) {
    conditions.push('final_model LIKE ?');
    params.push(`%${filter.model}%`);
  }
  if (filter.status) {
    conditions.push('status = ?');
    params.push(filter.status);
  }
  if (filter.from) {
    conditions.push('timestamp >= ?');
    params.push(filter.from);
  }
  if (filter.to) {
    conditions.push('timestamp <= ?');
    params.push(filter.to);
  }
  if (filter.search) {
    conditions.push('(prompt LIKE ? OR final_model LIKE ? OR category LIKE ?)');
    const term = `%${filter.search}%`;
    params.push(term, term, term);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const total = (db()
    .prepare(`SELECT COUNT(*) as count FROM requests ${where}`)
    .get(...params) as { count: number }).count;

  const rows = db()
    .prepare(`SELECT * FROM requests ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);

  return { rows, total };
}

export function apiRequestsExport(filter: RequestsFilter = {}, format: 'json' | 'csv' = 'json'): string {
  if (!connected()) return format === 'csv' ? '' : '[]';

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.model) { conditions.push('final_model LIKE ?'); params.push(`%${filter.model}%`); }
  if (filter.status) { conditions.push('status = ?'); params.push(filter.status); }
  if (filter.from) { conditions.push('timestamp >= ?'); params.push(filter.from); }
  if (filter.to) { conditions.push('timestamp <= ?'); params.push(filter.to); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db()
    .prepare(`SELECT * FROM requests ${where} ORDER BY timestamp DESC`)
    .all(...params) as Record<string, unknown>[];

  if (format === 'json') return JSON.stringify(rows, null, 2);

  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const csvRows = [
    headers.join(','),
    ...rows.map(r => headers.map(h => {
      const v = String(r[h] ?? '');
      return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(',')),
  ];
  return csvRows.join('\n');
}

export function apiModels() {
  if (!connected()) return [];
  return getModelPerformance();
}

export function apiBlacklist() {
  if (!connected()) return [];
  return db()
    .prepare("SELECT * FROM failure_patterns WHERE blacklist_until > datetime('now') ORDER BY blacklist_until DESC")
    .all();
}

export function apiCategories() {
  if (!connected()) return [];
  const rows = db()
    .prepare(`
      SELECT category,
             COUNT(*) as count,
             ROUND(AVG(CASE WHEN status = 'success' THEN 1.0 ELSE 0.0 END) * 100, 1) as successRate
      FROM requests
      WHERE category IS NOT NULL
      GROUP BY category
      ORDER BY count DESC
    `)
    .all() as { category: string; count: number; successRate: number }[];
  return rows;
}

function cliExists(cmd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const which = process.platform === 'win32' ? 'where' : 'which';
    execFile(which, [cmd], (err) => resolve(!err));
  });
}

export async function apiBackends() {
  const [claude, gemini, cursorAgent] = await Promise.all([
    cliExists('claude'),
    cliExists('gemini'),
    cliExists('cursor-agent'),
  ]);
  const hasOpenRouterKey = !!process.env['OPENROUTER_KEY'];
  const hasGeminiApiKey = !!(process.env['GEMINI_API_KEY'] ?? process.env['GOOGLE_API_KEY']);
  return [
    { name: 'Claude CLI', id: 'claude-cli', type: 'cli', available: claude, description: 'Anthropic Claude Code (text)', free: true },
    { name: 'Gemini CLI', id: 'gemini-cli', type: 'cli', available: gemini, description: 'Google Gemini CLI (text)', free: true },
    { name: 'Cursor Agent', id: 'cursor-cli', type: 'cli', available: cursorAgent, description: 'Cursor Agent CLI (text)', free: true },
    { name: 'Gemini API', id: 'gemini-api', type: 'api', available: hasGeminiApiKey, description: 'Gemini API — tool calls (set GEMINI_API_KEY)', free: true },
    { name: 'OpenRouter', id: 'openrouter', type: 'api', available: hasOpenRouterKey, description: 'OpenRouter API (paid)', free: false },
  ];
}

export function apiActivity() {
  if (!connected()) return [];
  const rows = db()
    .prepare(`
      SELECT strftime('%H:00', timestamp) as hour,
             COUNT(*) as count
      FROM requests
      WHERE timestamp >= datetime('now', '-24 hours')
      GROUP BY hour
      ORDER BY hour
    `)
    .all() as { hour: string; count: number }[];
  return rows;
}
