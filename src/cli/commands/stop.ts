import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { isServerRunning, stopServer } from '../../server';

const PID_FILE = path.join(os.homedir(), '.switch-ai', 'server.pid');

export async function cmdStop(): Promise<void> {
  // Stop in-process server if running
  if (isServerRunning()) {
    await stopServer();
    console.log(chalk.green('✓ Server stopped'));
    return;
  }

  // Try PID file for out-of-process server
  if (!fs.existsSync(PID_FILE)) {
    console.log(chalk.yellow('No running server found'));
    return;
  }

  const pidStr = fs.readFileSync(PID_FILE, 'utf-8').trim();
  const pid = parseInt(pidStr, 10);

  if (isNaN(pid)) {
    fs.unlinkSync(PID_FILE);
    console.log(chalk.yellow('Invalid PID file — removed'));
    return;
  }

  try {
    process.kill(pid, 'SIGTERM');
    fs.unlinkSync(PID_FILE);
    console.log(chalk.green(`✓ Sent stop signal to PID ${pid}`));
  } catch {
    fs.unlinkSync(PID_FILE);
    console.log(chalk.yellow(`Process ${pid} not found — cleaned up stale PID file`));
  }
}

export async function cmdStatus(): Promise<void> {
  if (isServerRunning()) {
    console.log(chalk.green('● Server running') + chalk.dim(' (in-process)'));
    return;
  }

  if (!fs.existsSync(PID_FILE)) {
    console.log(chalk.red('● Server not running'));
    return;
  }

  const pidStr = fs.readFileSync(PID_FILE, 'utf-8').trim();
  const pid = parseInt(pidStr, 10);

  if (isNaN(pid)) {
    fs.unlinkSync(PID_FILE);
    console.log(chalk.red('● Server not running') + chalk.dim(' (invalid PID file removed)'));
    return;
  }

  try {
    process.kill(pid, 0); // Check if alive
    console.log(chalk.green(`● Server running`) + chalk.dim(` (PID ${pid})`));
  } catch {
    fs.unlinkSync(PID_FILE);
    console.log(chalk.yellow('● Server not running') + chalk.dim(' (stale PID removed)'));
  }
}
