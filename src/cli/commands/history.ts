import path from 'path';
import chalk from 'chalk';
import { databaseManager } from '../../memory';
import { getCostSummary, getModelPerformance, getTopModels } from '../../memory/analytics';
import configManager from '../../config';

function connectDb(): boolean {
  if (databaseManager.isConnected()) return true;

  try {
    const config = configManager.load();
    const dbPath = path.join(config.memory.path, 'memory.db');
    databaseManager.connect(dbPath);
    return true;
  } catch {
    console.error(chalk.red('Could not connect to database'));
    return false;
  }
}

export function cmdHistory(limit = 20): void {
  if (!connectDb()) return;

  const db = databaseManager.getDb();
  const rows = db
    .prepare('SELECT * FROM requests ORDER BY timestamp DESC LIMIT ?')
    .all(limit) as Array<{
    status: string;
    final_model: string;
    category: string;
    latency_ms: number;
    cost: number;
    timestamp: string;
    complexity_score: number;
  }>;

  if (rows.length === 0) {
    console.log(chalk.dim('No request history'));
    return;
  }

  console.log(chalk.bold(`\nRecent Requests (last ${rows.length}):\n`));

  for (const row of rows) {
    const status =
      row.status === 'success' ? chalk.green('✓') : chalk.red('✗');
    const date = new Date(row.timestamp).toLocaleTimeString();
    const cost = row.cost > 0 ? chalk.dim(` $${row.cost.toFixed(5)}`) : '';
    console.log(
      `  ${status} ${date}  ${chalk.cyan(row.final_model.padEnd(35))} ` +
        `[${chalk.dim(row.category)}] ${row.latency_ms}ms${cost}`
    );
  }
}

export function cmdStats(): void {
  if (!connectDb()) return;

  const summary = getCostSummary();
  const byCategory = ['code', 'research', 'documentation', 'tests', 'architecture'];

  console.log(chalk.bold('\nSwitch AI Statistics:\n'));
  console.log(`  Total requests:    ${chalk.cyan(String(summary.totalRequests))}`);
  console.log(`  Total cost:        ${chalk.cyan('$' + summary.totalCost.toFixed(4))}`);
  console.log(
    `  Avg cost/request:  ${chalk.cyan('$' + summary.avgCostPerRequest.toFixed(6))}`
  );

  const allPerf = getModelPerformance();
  if (allPerf.length > 0) {
    const totalRequests = allPerf.reduce((s, m) => s + m.attempts, 0);
    const totalSuccesses = allPerf.reduce((s, m) => s + m.successes, 0);
    const overallRate = totalRequests > 0 ? (totalSuccesses / totalRequests) * 100 : 0;
    console.log(`  Success rate:      ${chalk.cyan(overallRate.toFixed(1) + '%')}`);
  }

  console.log(chalk.bold('\nTop Models by Category:\n'));
  for (const cat of byCategory) {
    const top = getTopModels(cat, 1);
    if (top.length > 0) {
      const m = top[0];
      const rate = ((m.success_rate ?? 0) * 100).toFixed(0);
      console.log(
        `  ${chalk.dim(cat.padEnd(15))} ${chalk.cyan(m.model.padEnd(35))} ` +
          `${rate}% success (${m.attempts} calls)`
      );
    }
  }
}
