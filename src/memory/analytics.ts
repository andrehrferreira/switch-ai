import databaseManager from './db';
import type { ModelPerformance } from './types';

export interface CostSummary {
  totalRequests: number;
  totalCost: number;
  avgCostPerRequest: number;
}

export function getModelPerformance(model?: string, category?: string): ModelPerformance[] {
  if (!databaseManager.isConnected()) return [];

  const db = databaseManager.getDb();

  if (model && category) {
    return db
      .prepare('SELECT * FROM model_performance WHERE model = ? AND category = ?')
      .all(model, category) as ModelPerformance[];
  }

  if (model) {
    return db
      .prepare('SELECT * FROM model_performance WHERE model = ?')
      .all(model) as ModelPerformance[];
  }

  if (category) {
    return db
      .prepare('SELECT * FROM model_performance WHERE category = ?')
      .all(category) as ModelPerformance[];
  }

  return db
    .prepare('SELECT * FROM model_performance ORDER BY success_rate DESC')
    .all() as ModelPerformance[];
}

export function getCostSummary(since?: string): CostSummary {
  if (!databaseManager.isConnected()) {
    return { totalRequests: 0, totalCost: 0, avgCostPerRequest: 0 };
  }

  const db = databaseManager.getDb();
  const row = (
    since
      ? db
          .prepare(
            'SELECT COUNT(*) as count, COALESCE(SUM(cost), 0) as total FROM requests WHERE timestamp >= ?'
          )
          .get(since)
      : db
          .prepare('SELECT COUNT(*) as count, COALESCE(SUM(cost), 0) as total FROM requests')
          .get()
  ) as { count: number; total: number };

  const avgCostPerRequest = row.count > 0 ? row.total / row.count : 0;

  return {
    totalRequests: row.count,
    totalCost: row.total,
    avgCostPerRequest,
  };
}

export function getTopModels(category: string, limit = 5): ModelPerformance[] {
  if (!databaseManager.isConnected()) return [];

  const db = databaseManager.getDb();
  return db
    .prepare(
      'SELECT * FROM model_performance WHERE category = ? ORDER BY success_rate DESC, avg_cost ASC LIMIT ?'
    )
    .all(category, limit) as ModelPerformance[];
}

export function getAllRequests(limit = 100) {
  if (!databaseManager.isConnected()) return [];
  const db = databaseManager.getDb();
  return db.prepare('SELECT * FROM requests ORDER BY timestamp DESC LIMIT ?').all(limit);
}
