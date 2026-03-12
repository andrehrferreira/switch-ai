import fastify from 'fastify';
import path from 'path';
import os from 'os';
import { databaseManager, getCostSummary, getModelPerformance } from '../../memory';

const server = fastify({ logger: true });

const DEFAULT_DB_PATH = path.join(os.homedir(), '.switch-ai', 'memory.db');

async function ensureConnected(): Promise<void> {
  if (!databaseManager.isConnected()) {
    await databaseManager.connect(DEFAULT_DB_PATH);
  }
}

server.get('/', async (_request, reply) => {
  reply.send('Welcome to the switch-ai dashboard!');
});

// Endpoint for all calls with filtering and pagination
server.get('/api/calls', async (_request, _reply) => {
  await ensureConnected();
  // TODO: implement getAllRequests in memory module
  return [];
});

// Endpoint for aggregated statistics
server.get('/api/stats', async (_request, _reply) => {
  await ensureConnected();
  const summary = getCostSummary();
  const db = databaseManager.getDb();
  const successCount = (db.prepare('SELECT COUNT(*) as count FROM requests WHERE status = ?').get('success') as { count: number }).count;
  const totalCount = (db.prepare('SELECT COUNT(*) as count FROM requests').get() as { count: number }).count;
  const successRate = totalCount > 0 ? successCount / totalCount : 0;
  return { ...summary, successRate };
});

// Endpoint for chart data
server.get('/api/chart-data', async (_request, _reply) => {
  await ensureConnected();
  // Cost over time
  const db = databaseManager.getDb();
  const costData = db.prepare(`
    SELECT strftime('%Y-%m', timestamp) as month, SUM(cost) as totalCost
    FROM requests
    WHERE timestamp >= strftime('%Y-%m-%d %H:%M:%S', 'now', '-3 months')
    GROUP BY month
    ORDER BY month
  `).all() as { month: string; totalCost: number }[];

  const costOverTime = {
    labels: costData.map(d => d.month),
    data: costData.map(d => d.totalCost),
  };

  // Latency per model
  const perfData = getModelPerformance();
  const latencyPerModel = {
    labels: perfData.map(p => p.model),
    data: perfData.map(p => p.avg_latency_ms),
  };

  return { costOverTime, latencyPerModel };
});

export const startServer = async (port: number) => {
  try {
    await server.listen({ port });
    server.log.info(`Server listening on http://localhost:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};
