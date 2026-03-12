import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import ora from 'ora';
import { startServer, isServerRunning } from '../../server';
import configManager from '../../config';
import logger from '../../utils/logger';
import { databaseManager } from '../../memory';
import { loadKeysIntoEnv } from './keys';

const LOG_FILE = path.join(os.homedir(), '.switch-ai', 'server.log');

export async function cmdClaude(claudeArgs: string[]): Promise<void> {
  const config = configManager.load();
  const port = config.server.port;
  const host = config.server.host;
  const baseUrl = `http://${host}:${port}`;

  let startedServer = false;

  // Load API keys from ~/.switch-ai/keys.env into process.env
  loadKeysIntoEnv();

  // Redirect server logs to file so they don't pollute Claude Code's UI
  logger.setLevel('debug');
  logger.setLogFile(LOG_FILE);

  if (!isServerRunning()) {
    // Prevent nested claude CLI calls: the proxy must not spawn claude from within Claude Code
    process.env['SWITCH_AI_PROXY_MODE'] = 'claude-code';

    const dbPath = path.join(os.homedir(), '.switch-ai', 'memory.db');
    await databaseManager.connect(dbPath);

    const spinner = ora('Starting Switch AI proxy...').start();
    try {
      await startServer(port, host);
      startedServer = true;
      spinner.succeed(chalk.green(`Proxy running at ${baseUrl}`));
    } catch (error) {
      const isAddrInUse =
        error instanceof Error && (error as NodeJS.ErrnoException).code === 'EADDRINUSE';
      if (isAddrInUse) {
        // Server already running in another process — reuse it
        spinner.succeed(chalk.dim(`Using existing proxy at ${baseUrl}`));
      } else {
        spinner.fail(chalk.red('Failed to start proxy'));
        throw error;
      }
    }
  } else {
    console.log(chalk.dim(`Using existing proxy at ${baseUrl}`));
  }

  console.log(chalk.dim(`ANTHROPIC_BASE_URL=${baseUrl}`));

  await new Promise<void>((resolve) => {
    const child = spawn('claude', claudeArgs, {
      stdio: 'inherit',
      env: { ...process.env, ANTHROPIC_BASE_URL: baseUrl },
    });

    child.on('error', (err) => {
      console.error(chalk.red(`Failed to run claude: ${err.message}`));
      console.error(chalk.dim('Is claude CLI installed? Run: npm install -g @anthropic-ai/claude-code'));
      process.exitCode = 1;
      resolve();
    });

    child.on('close', (code) => {
      process.exitCode = code ?? 0;
      resolve();
    });
  });

  if (startedServer) {
    await import('../../server').then((m) => m.stopServer());
  }

  process.exit(process.exitCode ?? 0);
}
