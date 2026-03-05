import { execFile as nodeExecFile } from 'child_process';
import { randomUUID } from 'crypto';
import type { AnthropicResponse, ContentBlock } from '../../server/types';
import { quotaManager } from '../quota-manager';
import logger from '../../utils/logger';

export type CliTool = 'claude' | 'gemini';
export type CliMessage = { role: string; content: string | ContentBlock[] };

const CLI_TIMEOUT_MS = 30_000;

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

function execAsync(file: string, args: string[], env?: NodeJS.ProcessEnv): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    nodeExecFile(file, args, { env, timeout: CLI_TIMEOUT_MS }, (err, stdout, stderr) => {
      if (err) {
        reject(new CliError(err.message, stderr, typeof err.code === 'number' ? err.code : null));
      } else {
        resolve({ stdout, stderr });
      }
    });
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
  // Check if we already know it's exhausted
  const modelId = `${tool}-cli`;
  if (quotaManager.isExhausted(modelId)) {
    return false;
  }

  // Don't invoke claude CLI from within a Claude Code session — nested sessions crash
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
    const { stdout } = await execAsync('claude', ['-p', prompt], cliEnv());
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
      logger.warn(`Claude CLI quota exceeded. Stderr: ${err.stderr}`);
    }
    throw err;
  }
}

export async function callGeminiCli(
  messages: CliMessage[],
  maxTokens: number
): Promise<AnthropicResponse> {
  const prompt = buildPrompt(messages);
  const modelId = 'gemini-cli';

  try {
    const { stdout } = await execAsync('gemini', [prompt, '--max-output-tokens', String(maxTokens)]);
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
