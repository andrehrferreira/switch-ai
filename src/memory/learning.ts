import databaseManager from './db';
import type { FailurePattern } from './types';

const BLACKLIST_DURATION_MS = 30 * 60 * 1000; // 30 minutes
export const FAILURE_THRESHOLD = 3;

export function recordFailure(model: string, category: string, errorType: string): void {
  if (!databaseManager.isConnected()) return;

  const db = databaseManager.getDb();
  const existing = db
    .prepare(
      'SELECT * FROM failure_patterns WHERE model = ? AND category = ? AND error_type = ?'
    )
    .get(model, category, errorType) as FailurePattern | undefined;

  if (existing) {
    const newCount = existing.count + 1;
    const blacklistUntil =
      newCount >= FAILURE_THRESHOLD
        ? new Date(Date.now() + BLACKLIST_DURATION_MS).toISOString()
        : null;

    db.prepare(
      'UPDATE failure_patterns SET count = ?, blacklist_until = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(newCount, blacklistUntil, existing.id);
  } else {
    db.prepare(
      'INSERT INTO failure_patterns (model, category, error_type) VALUES (?, ?, ?)'
    ).run(model, category, errorType);
  }
}

export function getBlacklistedModels(): string[] {
  if (!databaseManager.isConnected()) return [];

  const db = databaseManager.getDb();
  const now = new Date().toISOString();
  const rows = db
    .prepare('SELECT DISTINCT model FROM failure_patterns WHERE blacklist_until > ?')
    .all(now) as Array<{ model: string }>;

  return rows.map((r) => r.model);
}

export function isModelBlacklisted(model: string): boolean {
  return getBlacklistedModels().includes(model);
}

export function clearBlacklist(model?: string): void {
  if (!databaseManager.isConnected()) return;

  const db = databaseManager.getDb();

  if (model) {
    db.prepare('UPDATE failure_patterns SET blacklist_until = NULL WHERE model = ?').run(model);
  } else {
    db.prepare('UPDATE failure_patterns SET blacklist_until = NULL').run();
  }
}
