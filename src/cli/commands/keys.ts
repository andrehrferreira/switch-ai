import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import axios from 'axios';

const KEYS_FILE = path.join(os.homedir(), '.switch-ai', 'keys.env');

const KNOWN_KEYS: Record<string, { description: string; validateUrl?: string }> = {
  OPENROUTER_KEY: {
    description: 'OpenRouter API key (pk-...)',
    validateUrl: 'https://openrouter.ai/api/v1/models',
  },
  ANTHROPIC_API_KEY: {
    description: 'Anthropic API key (sk-ant-...)',
  },
  OPENAI_API_KEY: {
    description: 'OpenAI API key (sk-...)',
  },
  GEMINI_API_KEY: {
    description: 'Google Gemini API key',
  },
};

function readKeysFile(): Record<string, string> {
  if (!fs.existsSync(KEYS_FILE)) return {};

  const content = fs.readFileSync(KEYS_FILE, 'utf-8');
  const result: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    result[key] = value;
  }

  return result;
}

function writeKeysFile(keys: Record<string, string>): void {
  fs.mkdirSync(path.dirname(KEYS_FILE), { recursive: true });
  const content =
    '# Switch AI API Keys\n# Generated automatically — do not commit this file\n\n' +
    Object.entries(keys)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n') +
    '\n';
  fs.writeFileSync(KEYS_FILE, content, { mode: 0o600 });
}

export function cmdKeysSet(name: string, value: string): void {
  const keys = readKeysFile();
  keys[name] = value;
  writeKeysFile(keys);
  const masked = value.slice(0, 6) + '...' + value.slice(-4);
  console.log(chalk.green(`✓ ${name} saved`) + chalk.dim(` (${masked})`));
  console.log(chalk.dim(`  Stored in ${KEYS_FILE}`));
}

export function cmdKeysList(): void {
  const keys = readKeysFile();
  // Also check environment
  const allKeys = new Set([...Object.keys(keys), ...Object.keys(KNOWN_KEYS)]);

  console.log(chalk.bold('\nAPI Key Status:\n'));

  for (const name of [...allKeys].sort()) {
    const fromFile = keys[name];
    const fromEnv = process.env[name];
    const value = fromFile ?? fromEnv;
    const source = fromFile ? 'file' : fromEnv ? 'env' : null;

    if (value) {
      const masked = value.slice(0, 6) + '...' + value.slice(-4);
      const sourceTag = chalk.dim(`[${source}]`);
      console.log(`  ${chalk.green('✓')} ${name.padEnd(20)} ${chalk.dim(masked)} ${sourceTag}`);
    } else {
      console.log(`  ${chalk.red('✗')} ${name.padEnd(20)} ${chalk.dim('not set')}`);
    }
  }
}

export function cmdKeysExport(): void {
  const keys = readKeysFile();

  if (Object.keys(keys).length === 0) {
    console.log(chalk.dim('No keys configured'));
    return;
  }

  console.log(chalk.bold('# Export these to your shell:\n'));
  for (const [name, value] of Object.entries(keys)) {
    console.log(`export ${name}="${value}"`);
  }
}

export async function cmdKeysValidate(name: string): Promise<void> {
  const keys = readKeysFile();
  const value = keys[name] ?? process.env[name];

  if (!value) {
    console.error(chalk.red(`✗ ${name} is not set`));
    process.exitCode = 1;
    return;
  }

  const info = KNOWN_KEYS[name];

  if (!info?.validateUrl) {
    console.log(chalk.yellow(`⚠ No validation available for ${name} — key is set`));
    return;
  }

  console.log(chalk.dim(`Validating ${name}...`));

  try {
    await axios.get(info.validateUrl, {
      headers: { Authorization: `Bearer ${value}` },
    });
    console.log(chalk.green(`✓ ${name} is valid`));
  } catch (err) {
    const status = axios.isAxiosError(err) ? err.response?.status : null;
    if (status === 401) {
      console.error(chalk.red(`✗ ${name} is invalid (401 Unauthorized)`));
    } else {
      console.error(chalk.red(`✗ Validation failed: ${err instanceof Error ? err.message : String(err)}`));
    }
    process.exitCode = 1;
  }
}
