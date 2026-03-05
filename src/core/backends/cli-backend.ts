import { exec as nodeExec } from 'child_process';
import { randomUUID } from 'crypto';
import type { AnthropicResponse, ContentBlock } from '../../server/types';
import { quotaManager } from '../quota-manager';
import logger from '../../utils/logger';

export type CliTool = 'claude' | 'gemini';
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
 *
 * Uses a shell on all platforms so npm global .cmd wrappers are found in PATH.
 * Arguments are manually quoted so prompts with spaces/special chars work correctly —
 * execFile({ shell: true }) joins args without quoting and breaks on Windows.
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

function cliEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  // Prevent nested Claude Code sessions
  delete env['CLAUDECODE'];
  // Prevent recursive proxy loops: unset ANTHROPIC_BASE_URL so CLI tools
  // connect directly to the real API, not back to our proxy
  delete env['ANTHROPIC_BASE_URL'];
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

  // claude -p does not work when launched from within a Claude Code session:
  // with CLAUDECODE set it refuses ("nested sessions"), without it it hangs.
  if (tool === 'claude' && process.env['CLAUDECODE']) {
    return false;
  }

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
    // -p: non-interactive print mode (process exits after response)
    // --output-format json: single JSON result object, no streaming hang
    // --dangerously-skip-permissions: skip tool approval prompts (like cursor-agent --force)
    // --no-session-persistence: don't write session files for proxy use
    const { stdout } = await execAsync(
      'claude',
      ['-p', '--output-format', 'json', '--dangerously-skip-permissions', '--no-session-persistence', prompt],
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
    const { stdout } = await execAsync('gemini', ['-p', prompt]);
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
