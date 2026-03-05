import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import ora from 'ora';
import { startServer, stopServer } from '../../server';
import { databaseManager } from '../../memory';
import configManager from '../../config';
import { readDiskCache, fetchOpenRouterModels } from '../../registry/openrouter';
import { modelRegistry } from '../../registry/model-registry';
import { loadKeysIntoEnv } from './keys';
import logger from '../../utils/logger';

const PID_FILE = path.join(os.homedir(), '.switch-ai', 'server.pid');

function writePid(): void {
  fs.mkdirSync(path.dirname(PID_FILE), { recursive: true });
  fs.writeFileSync(PID_FILE, String(process.pid));
}

function removePid(): void {
  if (fs.existsSync(PID_FILE)) {
    fs.unlinkSync(PID_FILE);
  }
}

export async function cmdStart(options: { port?: number; host?: string } = {}): Promise<void> {
  logger.setLevel('debug');
  loadKeysIntoEnv();
  const config = configManager.load();
  const port = options.port ?? config.server.port;
  const host = options.host ?? config.server.host;

  // Connect DB
  const dbPath = path.join(config.memory.path, 'memory.db');
  databaseManager.connect(dbPath);

  // Auto-sync models from OpenRouter if no valid cache
  if (!readDiskCache()) {
    const syncSpinner = ora('Fetching models from OpenRouter...').start();
    try {
      const models = await fetchOpenRouterModels();
      modelRegistry.reload(models);
      syncSpinner.succeed(chalk.dim(`Loaded ${models.length} models from OpenRouter`));
    } catch {
      syncSpinner.warn(chalk.yellow('Could not fetch models from OpenRouter — using bundled list'));
    }
  }

  const spinner = ora('Starting Switch AI proxy...').start();

  try {
    await startServer(port, host);
    writePid();
    spinner.succeed(chalk.green(`Switch AI proxy running at http://${host}:${port}/v1/messages`));
    console.log(chalk.dim(`  Set: export ANTHROPIC_BASE_URL=http://${host}:${port}`));
    console.log(chalk.dim('  Press Ctrl+C to stop'));

    const shutdown = async () => {
      process.stdout.write('\n');
      const stop = ora('Stopping...').start();
      await stopServer();
      removePid();
      stop.succeed('Server stopped');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Keep process alive
    await new Promise<never>(() => {});
  } catch (error) {
    spinner.fail(
      chalk.red(`Failed to start: ${error instanceof Error ? error.message : String(error)}`)
    );
    throw error;
  }
}
