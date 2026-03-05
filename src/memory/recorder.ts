import { randomUUID } from 'crypto';
import databaseManager from './db';
import type { ModelPerformance } from './types';

export interface RecordData {
  prompt: string;
  initialModel: string;
  finalModel: string;
  category: string;
  complexityScore: number;
  status: 'success' | 'failure' | 'error';
  latencyMs: number;
  tokensInput: number;
  tokensOutput: number;
  cost: number;
  validationPassed: boolean;
  escalations: number;
}

export function recordRequest(data: RecordData): string {
  if (!databaseManager.isConnected()) return '';

  const id = randomUUID();
  const db = databaseManager.getDb();

  db.prepare(
    `INSERT INTO requests
       (id, prompt, initial_model, final_model, category, complexity_score,
        status, latency_ms, tokens_input, tokens_output, cost, validation_passed, escalations)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.prompt,
    data.initialModel,
    data.finalModel,
    data.category,
    data.complexityScore,
    data.status,
    data.latencyMs,
    data.tokensInput,
    data.tokensOutput,
    data.cost,
    data.validationPassed ? 1 : 0,
    data.escalations
  );

  updateModelPerformance(
    data.finalModel,
    data.category,
    data.status === 'success',
    data.latencyMs,
    data.cost
  );

  return id;
}

export function updateModelPerformance(
  model: string,
  category: string,
  success: boolean,
  latencyMs: number,
  cost: number
): void {
  if (!databaseManager.isConnected()) return;

  const db = databaseManager.getDb();
  const existing = db
    .prepare('SELECT * FROM model_performance WHERE model = ? AND category = ?')
    .get(model, category) as ModelPerformance | undefined;

  if (existing) {
    const newAttempts = existing.attempts + 1;
    const newSuccesses = existing.successes + (success ? 1 : 0);
    const prevLatency = existing.avg_latency_ms ?? latencyMs;
    const prevCost = existing.avg_cost ?? cost;

    db.prepare(
      `UPDATE model_performance
       SET attempts = ?, successes = ?, failures = ?,
           success_rate = ?, avg_latency_ms = ?, avg_cost = ?,
           last_used = CURRENT_TIMESTAMP
       WHERE model = ? AND category = ?`
    ).run(
      newAttempts,
      newSuccesses,
      newAttempts - newSuccesses,
      newSuccesses / newAttempts,
      (prevLatency * (newAttempts - 1) + latencyMs) / newAttempts,
      (prevCost * (newAttempts - 1) + cost) / newAttempts,
      model,
      category
    );
  } else {
    db.prepare(
      `INSERT INTO model_performance
         (model, category, attempts, successes, failures, success_rate, avg_latency_ms, avg_cost, last_used)
       VALUES (?, ?, 1, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).run(
      model,
      category,
      success ? 1 : 0,
      success ? 0 : 1,
      success ? 1.0 : 0.0,
      latencyMs,
      cost
    );
  }
}
