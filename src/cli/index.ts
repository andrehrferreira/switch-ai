import fs from 'fs';
import path from 'path';
import os from 'os';
import { Command } from 'commander';
import chalk from 'chalk';
import { cmdStart } from './commands/start';

// Load API keys: ~/.switch-ai/keys.env then local .env (local wins over global)
function loadKeys(): void {
  const sources = [
    path.join(os.homedir(), '.switch-ai', 'keys.env'),
    path.join(process.cwd(), '.env'),
  ];
  for (const file of sources) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf-8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}
loadKeys();
import { cmdStop, cmdStatus } from './commands/stop';
import { cmdModelsList, cmdModelsShow, cmdModelsSync } from './commands/models';
import { cmdKeysSet, cmdKeysList, cmdKeysExport, cmdKeysValidate } from './commands/keys';
import { cmdClaude } from './commands/claude';
import { cmdHistory, cmdStats } from './commands/history';
import { dashboardCommand } from './commands/dashboard';

const program = new Command();

program
  .name('switch-ai')
  .description('Intelligent AI model router — automatically selects the best model for your task')
  .version('0.1.0');

// ─── Core commands ───────────────────────────────────────────────────────────

program
  .command('start')
  .description('Start the Switch AI proxy server')
  .option('-p, --port <number>', 'Port to listen on', parseInt)
  .option('-H, --host <string>', 'Host to bind to')
  .action((opts) => cmdStart(opts).catch(fatal));

program
  .command('stop')
  .description('Stop the running proxy server')
  .action(() => cmdStop().catch(fatal));

program
  .command('status')
  .description('Show proxy server status')
  .action(() => cmdStatus().catch(fatal));

// ─── Models ──────────────────────────────────────────────────────────────────

const models = program.command('models').description('Manage AI models');

models
  .command('list')
  .description('List available models')
  .option('-t, --tier <tier>', 'Filter by tier (free|cheap|balanced|premium)')
  .option('-c, --category <category>', 'Filter by category (code|research|tests|...)')
  .option('-k, --key <apiKey>', 'OpenRouter API key')
  .option('--json', 'Output as JSON')
  .action((opts) => cmdModelsList(opts).catch(fatal));

models
  .command('show <id>')
  .description('Show details for a specific model')
  .option('-k, --key <apiKey>', 'OpenRouter API key')
  .action((id: string, opts: { key?: string }) => cmdModelsShow(id, opts.key).catch(fatal));

models
  .command('sync')
  .description('Fetch latest models from OpenRouter')
  .option('-k, --key <apiKey>', 'OpenRouter API key (or set OPENROUTER_KEY env var)')
  .action((opts) => cmdModelsSync(opts.key).catch(fatal));

// ─── Keys ────────────────────────────────────────────────────────────────────

const keys = program.command('keys').description('Manage API keys');

keys
  .command('set <name> <value>')
  .description('Set an API key (e.g. OPENROUTER_KEY sk-...)')
  .action((name: string, value: string) => cmdKeysSet(name, value));

keys
  .command('list')
  .description('List configured API keys')
  .action(() => cmdKeysList());

keys
  .command('export')
  .description('Print export statements for all configured keys')
  .action(() => cmdKeysExport());

keys
  .command('validate <name>')
  .description('Validate an API key by making a test request')
  .action((name: string) => cmdKeysValidate(name).catch(fatal));

// ─── Claude integration ───────────────────────────────────────────────────────

program
  .command('claude [args...]')
  .description('Start proxy and run claude CLI with ANTHROPIC_BASE_URL set')
  .allowUnknownOption()
  .action((args: string[]) => cmdClaude(args).catch(fatal));

// ─── History & analytics ──────────────────────────────────────────────────────

program
  .command('history')
  .description('Show recent request history')
  .option('-n, --limit <number>', 'Number of records to show', parseInt)
  .action((opts) => cmdHistory(opts.limit));

program
  .command('stats')
  .description('Show model performance statistics')
  .action(() => cmdStats());

program.addCommand(dashboardCommand);

// ─── Error handler ────────────────────────────────────────────────────────────

function fatal(error: unknown): void {
  console.error(
    chalk.red('Error:'),
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
}

program.parse(process.argv);
