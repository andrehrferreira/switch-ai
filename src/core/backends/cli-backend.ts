import { exec as nodeExec, spawn } from 'child_process';
import { randomUUID } from 'crypto';
import type { AnthropicResponse, ContentBlock } from '../../server/types';
import { quotaManager } from '../quota-manager';
import logger from '../../utils/logger';

export type CliTool = 'claude' | 'gemini' | 'cursor-agent';
export type CliMessage = { role: string; content: string | ContentBlock[] };

// Gemini CLI can take 20-40s for a response — use a generous timeout
const CLI_TIMEOUT_MS = 90_000;

class CliError extends Error {
  constructor(message: string, public readonly stderr: string, public readonly code?: number | null) {
    super(message);
    this.name = 'CliError';
  }

  isQuotaExceeded(): boolean {
    const combined = (this.message + ' ' + this.stderr).toLowerCase();
    return (
      combined.includes('quota exceeded') ||
      combined.includes('limit reached') ||
      combined.includes('rate limit') ||
      combined.includes('429') ||
      combined.includes('too many requests') ||
      combined.includes('credit limit') ||
      combined.includes('insufficient balance')
    );
  }
}

/** Quote a shell argument. Uses CMD.EXE double-quote syntax on Windows, POSIX single-quotes elsewhere. */
function shellQuote(s: string): string {
  if (process.platform === 'win32') {
    if (!/[\s"&|<>^%!()\[\]{}]/.test(s)) return s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  /* v8 ignore next */
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

/**
 * Run a CLI command and capture output via exec (shell mode).
 * Used for short commands (e.g. `which`). For long prompts, use spawnWithStdin.
 */
function execAsync(file: string, args: string[], env?: NodeJS.ProcessEnv): Promise<{ stdout: string; stderr: string }> {
  const cmd = [file, ...args.map(shellQuote)].join(' ');
  return new Promise((resolve, reject) => {
    nodeExec(
      cmd,
      { env, timeout: CLI_TIMEOUT_MS },
      (err, stdout, stderr) => {
        if (err) {
          reject(new CliError(err.message, String(stderr), typeof err.code === 'number' ? err.code : null));
        } else {
          resolve({ stdout: String(stdout), stderr: String(stderr) });
        }
      }
    );
  });
}

/**
 * Spawn a CLI command, pipe the prompt via stdin, and capture output.
 * Avoids OS argument length limits for large prompts.
 */
function spawnWithStdin(
  file: string,
  args: string[],
  stdinData: string,
  env?: NodeJS.ProcessEnv
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    // Do NOT use shell: true — it strips empty string arguments (e.g. `-p ""`)
    // which breaks Gemini CLI. spawn already searches PATH without shell.
    const child = spawn(file, args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: CLI_TIMEOUT_MS,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });

    child.on('error', (err) => {
      reject(new CliError(err.message, stderr, null));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new CliError(`Process exited with code ${code}`, stderr, code));
      } else {
        resolve({ stdout, stderr });
      }
    });

    child.stdin.write(stdinData);
    child.stdin.end();
  });
}

function cliEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  // Prevent nested Claude Code sessions
  delete env['CLAUDECODE'];
  // Prevent recursive proxy loops: unset ANTHROPIC_BASE_URL so CLI tools
  // connect directly to the real API, not back to our proxy
  delete env['ANTHROPIC_BASE_URL'];
  // Clean up switch-ai internal env vars
  delete env['SWITCH_AI_SERVER'];
  delete env['SWITCH_AI_PROXY_MODE'];
  return env;
}

function extractText(content: string | ContentBlock[]): string {
  if (typeof content === 'string') return content;
  return content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

function buildPrompt(messages: CliMessage[]): string {
  const userMessages = messages.filter((m) => m.role === 'user');
  return extractText(userMessages[userMessages.length - 1]?.content ?? '');
}

export async function detectCliTool(tool: CliTool): Promise<boolean> {
  const modelId = `${tool}-cli`;
  if (quotaManager.isExhausted(modelId)) {
    return false;
  }

  // Loop prevention is handled by cliEnv() which removes ANTHROPIC_BASE_URL
  // and CLAUDECODE, so spawned CLI processes talk directly to their APIs.

  const command = process.platform === 'win32' ? 'where' : /* v8 ignore next */ 'which';
  try {
    await execAsync(command, [tool]);
    return true;
  } catch {
    return false;
  }
}

export async function callClaudeCli(
  messages: CliMessage[],
  _maxTokens: number
): Promise<AnthropicResponse> {
  const prompt = buildPrompt(messages);
  const modelId = 'claude-cli';

  try {
    // -p: non-interactive print mode, reads prompt from stdin
    // --output-format json: single JSON result object, no streaming hang
    // --dangerously-skip-permissions: skip tool approval prompts (like cursor-agent --force)
    // --no-session-persistence: don't write session files for proxy use
    // Prompt is piped via stdin to avoid OS argument length limits
    const { stdout } = await spawnWithStdin(
      'claude',
      ['-p', '--output-format', 'json', '--dangerously-skip-permissions', '--no-session-persistence'],
      prompt,
      cliEnv()
    );
    quotaManager.markAvailable(modelId);

    // Parse JSON result: { type: 'result', result: '...', is_error: false, ... }
    // Fall back to raw stdout for older claude versions that don't support --output-format.
    let text = stdout.trim();
    try {
      const parsed = JSON.parse(text) as { result?: string; is_error?: boolean };
      if (typeof parsed.result === 'string') {
        text = parsed.result;
      }
    } catch {
      // Not JSON — use raw stdout as-is
    }

    return {
      id: `msg_${randomUUID()}`,
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text }],
      model: modelId,
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    };
  } catch (err) {
    if (err instanceof CliError && err.isQuotaExceeded()) {
      quotaManager.markExhausted(modelId);
      logger.warn(`Claude CLI quota exceeded. Stderr: ${err.stderr}`);
    }
    throw err;
  }
}

export async function callGeminiCli(
  messages: CliMessage[],
  _maxTokens: number
): Promise<AnthropicResponse> {
  const prompt = buildPrompt(messages);
  const modelId = 'gemini-cli';

  try {
    // Pipe prompt via stdin to avoid OS argument length limits.
    // Gemini CLI requires -p with a value; pass empty string so it reads from stdin.
    const { stdout } = await spawnWithStdin('gemini', ['-p', ''], prompt);
    quotaManager.markAvailable(modelId);

    return {
      id: `msg_${randomUUID()}`,
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: stdout.trim() }],
      model: modelId,
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    };
  } catch (err) {
    if (err instanceof CliError && err.isQuotaExceeded()) {
      quotaManager.markExhausted(modelId);
      logger.warn(`Gemini CLI quota exceeded. Stderr: ${err.stderr}`);
    }
    throw err;
  }
}

export async function callCursorCli(
  messages: CliMessage[],
  _maxTokens: number
): Promise<AnthropicResponse> {
  const prompt = buildPrompt(messages);
  const modelId = 'cursor-cli';

  try {
    // cursor-agent: non-interactive mode, reads prompt from stdin
    const { stdout } = await spawnWithStdin(
      'cursor-agent',
      ['-p'],
      prompt,
      cliEnv()
    );
    quotaManager.markAvailable(modelId);

    let text = stdout.trim();
    try {
      const parsed = JSON.parse(text) as { result?: string };
      if (typeof parsed.result === 'string') {
        text = parsed.result;
      }
    } catch {
      // Not JSON — use raw stdout as-is
    }

    return {
      id: `msg_${randomUUID()}`,
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text }],
      model: modelId,
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    };
  } catch (err) {
    if (err instanceof CliError && err.isQuotaExceeded()) {
      quotaManager.markExhausted(modelId);
      logger.warn(`Cursor CLI quota exceeded. Stderr: ${err.stderr}`);
    }
    throw err;
  }
}
