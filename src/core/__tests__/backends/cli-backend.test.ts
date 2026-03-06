import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { Writable, Readable } from 'stream';

// Mock child_process before importing cli-backend
vi.mock('child_process', () => ({
  exec: vi.fn(),
  spawn: vi.fn(),
}));

// Mock quota-manager to avoid exhaustion checks
vi.mock('../../../core/quota-manager', () => ({
  quotaManager: {
    isExhausted: vi.fn().mockReturnValue(false),
    markAvailable: vi.fn(),
    markExhausted: vi.fn(),
  },
}));

import { exec, spawn } from 'child_process';
import { quotaManager } from '../../../core/quota-manager';
import { detectCliTool, callClaudeCli, callGeminiCli, callCursorCli } from '../../backends/cli-backend';

type AnyCallback = (err: Error | null, stdout: string, stderr: string) => void;

function mockExecSuccess(output: string) {
  vi.mocked(exec).mockImplementation((...args: unknown[]) => {
    const cb = args.find((a) => typeof a === 'function') as AnyCallback;
    process.nextTick(() => cb(null, output, ''));
    return {} as ReturnType<typeof exec>;
  });
}

function mockExecError(message: string) {
  vi.mocked(exec).mockImplementation((...args: unknown[]) => {
    const cb = args.find((a) => typeof a === 'function') as AnyCallback;
    process.nextTick(() => cb(new Error(message), '', ''));
    return {} as ReturnType<typeof exec>;
  });
}

/** Create a mock child process for spawn that resolves with output */
function mockSpawnSuccess(output: string) {
  vi.mocked(spawn).mockImplementation(() => {
    const child = new EventEmitter() as ReturnType<typeof spawn>;
    const stdoutEmitter = new EventEmitter();
    const stderrEmitter = new EventEmitter();
    const stdinStream = new Writable({ write(_chunk, _enc, cb) { cb(); } });

    child.stdout = stdoutEmitter as ReturnType<typeof spawn>['stdout'];
    child.stderr = stderrEmitter as ReturnType<typeof spawn>['stderr'];
    child.stdin = stdinStream as ReturnType<typeof spawn>['stdin'];

    process.nextTick(() => {
      stdoutEmitter.emit('data', output);
      child.emit('close', 0);
    });

    return child;
  });
}

function mockSpawnError(message: string) {
  vi.mocked(spawn).mockImplementation(() => {
    const child = new EventEmitter() as ReturnType<typeof spawn>;
    const stdoutEmitter = new EventEmitter();
    const stderrEmitter = new EventEmitter();
    const stdinStream = new Writable({ write(_chunk, _enc, cb) { cb(); } });

    child.stdout = stdoutEmitter as ReturnType<typeof spawn>['stdout'];
    child.stderr = stderrEmitter as ReturnType<typeof spawn>['stderr'];
    child.stdin = stdinStream as ReturnType<typeof spawn>['stdin'];

    process.nextTick(() => {
      stderrEmitter.emit('data', message);
      child.emit('close', 1);
    });

    return child;
  });
}

/** Mock spawn that fails with stderr containing a specific error message.
 * The CliError class is internal to cli-backend, and spawnWithStdin creates one
 * on non-zero exit code. The isQuotaExceeded() check looks at error.message and stderr. */
function mockSpawnErrorWithCliError(stderr: string) {
  vi.mocked(spawn).mockImplementation(() => {
    const child = new EventEmitter() as ReturnType<typeof spawn>;
    const stdoutEmitter = new EventEmitter();
    const stderrEmitter = new EventEmitter();
    const stdinStream = new Writable({ write(_chunk, _enc, cb) { cb(); } });

    child.stdout = stdoutEmitter as ReturnType<typeof spawn>['stdout'];
    child.stderr = stderrEmitter as ReturnType<typeof spawn>['stderr'];
    child.stdin = stdinStream as ReturnType<typeof spawn>['stdin'];

    process.nextTick(() => {
      stderrEmitter.emit('data', stderr);
      child.emit('close', 1);
    });

    return child;
  });
}

/** Returns the args from the last spawn call.
 * On Windows, command+args are merged into a single string (shell mode),
 * so we parse them back for assertion convenience. */
function getSpawnArgs(): { command: string; args: string[]; options: Record<string, unknown> } {
  const call = vi.mocked(spawn).mock.calls[0];
  const rawCommand = call?.[0] as string ?? '';
  const rawArgs = (call?.[1] as string[]) ?? [];
  const options = (call?.[2] as Record<string, unknown>) ?? {};

  // On Windows the code joins file+args into a single command string
  if (process.platform === 'win32' && rawArgs.length === 0 && rawCommand.includes(' ')) {
    const parts = rawCommand.split(/\s+/);
    return { command: parts[0], args: parts.slice(1), options };
  }
  return { command: rawCommand, args: rawArgs, options };
}

// Clear CLAUDECODE env for tests
beforeEach(() => {
  delete process.env['CLAUDECODE'];
  delete process.env['SWITCH_AI_SERVER'];
  delete process.env['SWITCH_AI_PROXY_MODE'];
});

describe('detectCliTool', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns true when CLI tool is found', async () => {
    mockExecSuccess('/usr/bin/claude\n');
    const result = await detectCliTool('claude');
    expect(result).toBe(true);
  });

  it('returns false when CLI tool is not found', async () => {
    mockExecError('not found');
    const result = await detectCliTool('claude');
    expect(result).toBe(false);
  });

  it('detects gemini tool', async () => {
    mockExecSuccess('/usr/bin/gemini\n');
    const result = await detectCliTool('gemini');
    expect(result).toBe(true);
  });

  it('returns true for claude even when SWITCH_AI_SERVER is set (loop prevention is in cliEnv)', async () => {
    process.env['SWITCH_AI_SERVER'] = '1';
    mockExecSuccess('/usr/bin/claude\n');
    const result = await detectCliTool('claude');
    expect(result).toBe(true);
  });

  it('returns true for claude even when SWITCH_AI_PROXY_MODE is set (loop prevention is in cliEnv)', async () => {
    process.env['SWITCH_AI_PROXY_MODE'] = 'claude-code';
    mockExecSuccess('/usr/bin/claude\n');
    const result = await detectCliTool('claude');
    expect(result).toBe(true);
  });

  it('still detects gemini when SWITCH_AI_SERVER is set', async () => {
    process.env['SWITCH_AI_SERVER'] = '1';
    mockExecSuccess('/usr/bin/gemini\n');
    const result = await detectCliTool('gemini');
    expect(result).toBe(true);
  });
});

describe('callClaudeCli', () => {
  const messages = [
    { role: 'system', content: 'You are helpful' },
    { role: 'user', content: 'Hello' },
  ];

  beforeEach(() => vi.clearAllMocks());

  it('returns AnthropicResponse on success with plain text output', async () => {
    mockSpawnSuccess('  Claude response text  ');
    const result = await callClaudeCli(messages, 100);
    expect(result.id).toMatch(/^msg_/);
    expect(result.type).toBe('message');
    expect(result.role).toBe('assistant');
    expect(result.content[0].text).toBe('Claude response text');
    expect(result.model).toBe('claude-cli');
    expect(result.stop_reason).toBe('end_turn');
    expect(result.stop_sequence).toBeNull();
    expect(result.usage).toEqual({ input_tokens: 0, output_tokens: 0 });
  });

  it('extracts result field from JSON output', async () => {
    const jsonOutput = JSON.stringify({
      type: 'result',
      subtype: 'success',
      is_error: false,
      result: 'Parsed from JSON',
      duration_ms: 1234,
      session_id: 'abc123',
    });
    mockSpawnSuccess(jsonOutput);
    const result = await callClaudeCli(messages, 100);
    expect(result.content[0].text).toBe('Parsed from JSON');
  });

  it('falls back to raw stdout when JSON is_error is not a string result', async () => {
    const jsonOutput = JSON.stringify({ type: 'result', is_error: true });
    mockSpawnSuccess(jsonOutput);
    const result = await callClaudeCli(messages, 100);
    // result field is absent → falls back to raw stdout
    expect(result.content[0].text).toBe(jsonOutput.trim());
  });

  it('spawns claude with required non-interactive flags', async () => {
    mockSpawnSuccess('output');
    await callClaudeCli(messages, 500);
    const { command, args } = getSpawnArgs();
    expect(command).toBe('claude');
    expect(args).toContain('-p');
    expect(args).toContain('--output-format');
    expect(args).toContain('json');
    expect(args).toContain('--dangerously-skip-permissions');
    expect(args).toContain('--no-session-persistence');
  });

  it('spawns claude without CLAUDECODE env var', async () => {
    process.env['CLAUDECODE'] = 'some-session-id';
    mockSpawnSuccess('output');
    await callClaudeCli(messages, 100);
    const { options } = getSpawnArgs();
    expect((options.env as NodeJS.ProcessEnv)?.['CLAUDECODE']).toBeUndefined();
    delete process.env['CLAUDECODE'];
  });

  it('spawns claude without ANTHROPIC_BASE_URL env var', async () => {
    process.env['ANTHROPIC_BASE_URL'] = 'http://localhost:3000';
    mockSpawnSuccess('output');
    await callClaudeCli(messages, 100);
    const { options } = getSpawnArgs();
    expect((options.env as NodeJS.ProcessEnv)?.['ANTHROPIC_BASE_URL']).toBeUndefined();
    delete process.env['ANTHROPIC_BASE_URL'];
  });

  it('uses last user message as prompt via stdin', async () => {
    mockSpawnSuccess('response');
    const msgs = [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'reply' },
      { role: 'user', content: 'second question' },
    ];
    await callClaudeCli(msgs, 100);
    // Prompt is sent via stdin, not as a command argument
    const { args } = getSpawnArgs();
    expect(args).not.toContain('second question');
  });

  it('propagates errors', async () => {
    mockSpawnError('claude not found');
    await expect(callClaudeCli(messages, 100)).rejects.toThrow();
  });
});

describe('callGeminiCli', () => {
  const messages = [{ role: 'user', content: 'Tell me about AI' }];

  beforeEach(() => vi.clearAllMocks());

  it('returns AnthropicResponse on success', async () => {
    mockSpawnSuccess('  Gemini response  ');
    const result = await callGeminiCli(messages, 200);
    expect(result.id).toMatch(/^msg_/);
    expect(result.content[0].text).toBe('Gemini response');
    expect(result.model).toBe('gemini-cli');
    expect(result.stop_reason).toBe('end_turn');
    expect(result.usage).toEqual({ input_tokens: 0, output_tokens: 0 });
  });

  it('spawns gemini with -p flag', async () => {
    mockSpawnSuccess('output');
    await callGeminiCli(messages, 300);
    const { command, args } = getSpawnArgs();
    expect(command).toBe('gemini');
    expect(args).toContain('-p');
  });

  it('propagates errors', async () => {
    mockSpawnError('gemini not found');
    await expect(callGeminiCli(messages, 100)).rejects.toThrow();
  });

  it('marks quota exhausted when error contains quota message', async () => {
    mockSpawnErrorWithCliError('quota exceeded');
    await expect(callGeminiCli(messages, 100)).rejects.toThrow();
    expect(quotaManager.markExhausted).toHaveBeenCalledWith('gemini-cli');
  });
});

describe('callCursorCli', () => {
  const messages = [{ role: 'user', content: 'Fix this bug' }];

  beforeEach(() => vi.clearAllMocks());

  it('returns AnthropicResponse on success with plain text', async () => {
    mockSpawnSuccess('  Cursor response text  ');
    const result = await callCursorCli(messages, 100);
    expect(result.id).toMatch(/^msg_/);
    expect(result.type).toBe('message');
    expect(result.role).toBe('assistant');
    expect(result.content[0].text).toBe('Cursor response text');
    expect(result.model).toBe('cursor-cli');
    expect(result.stop_reason).toBe('end_turn');
    expect(result.usage).toEqual({ input_tokens: 0, output_tokens: 0 });
  });

  it('extracts result field from JSON output', async () => {
    const jsonOutput = JSON.stringify({ result: 'Parsed cursor output' });
    mockSpawnSuccess(jsonOutput);
    const result = await callCursorCli(messages, 100);
    expect(result.content[0].text).toBe('Parsed cursor output');
  });

  it('falls back to raw stdout when JSON has no result field', async () => {
    const jsonOutput = JSON.stringify({ type: 'result', is_error: true });
    mockSpawnSuccess(jsonOutput);
    const result = await callCursorCli(messages, 100);
    expect(result.content[0].text).toBe(jsonOutput.trim());
  });

  it('spawns cursor-agent with -p and -f flags', async () => {
    mockSpawnSuccess('output');
    await callCursorCli(messages, 500);
    const { command, args } = getSpawnArgs();
    expect(command).toBe('cursor-agent');
    expect(args).toContain('-p');
    expect(args).toContain('-f');
  });

  it('spawns without ANTHROPIC_BASE_URL env var', async () => {
    process.env['ANTHROPIC_BASE_URL'] = 'http://localhost:3000';
    mockSpawnSuccess('output');
    await callCursorCli(messages, 100);
    const { options } = getSpawnArgs();
    expect((options.env as NodeJS.ProcessEnv)?.['ANTHROPIC_BASE_URL']).toBeUndefined();
    delete process.env['ANTHROPIC_BASE_URL'];
  });

  it('propagates errors', async () => {
    mockSpawnError('cursor-agent not found');
    await expect(callCursorCli(messages, 100)).rejects.toThrow();
  });

  it('marks quota exhausted when error contains rate limit message', async () => {
    mockSpawnErrorWithCliError('rate limit exceeded');
    await expect(callCursorCli(messages, 100)).rejects.toThrow();
    expect(quotaManager.markExhausted).toHaveBeenCalledWith('cursor-cli');
  });
});

describe('quota exhaustion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('detectCliTool returns false when quota is exhausted', async () => {
    vi.mocked(quotaManager.isExhausted).mockReturnValue(true);
    const result = await detectCliTool('claude');
    expect(result).toBe(false);
    expect(exec).not.toHaveBeenCalled();
  });

  it('callClaudeCli marks exhausted on quota error', async () => {
    mockSpawnErrorWithCliError('quota exceeded for claude');
    await expect(callClaudeCli([{ role: 'user', content: 'test' }], 100)).rejects.toThrow();
    expect(quotaManager.markExhausted).toHaveBeenCalledWith('claude-cli');
  });
});

describe('spawn error event', () => {
  beforeEach(() => vi.clearAllMocks());

  it('handles spawn error event (e.g. ENOENT)', async () => {
    vi.mocked(spawn).mockImplementation(() => {
      const child = new EventEmitter() as ReturnType<typeof spawn>;
      const stdoutEmitter = new EventEmitter();
      const stderrEmitter = new EventEmitter();
      const stdinStream = new Writable({ write(_chunk, _enc, cb) { cb(); } });

      child.stdout = stdoutEmitter as ReturnType<typeof spawn>['stdout'];
      child.stderr = stderrEmitter as ReturnType<typeof spawn>['stderr'];
      child.stdin = stdinStream as ReturnType<typeof spawn>['stdin'];

      process.nextTick(() => {
        child.emit('error', new Error('spawn ENOENT'));
      });

      return child;
    });

    await expect(callClaudeCli([{ role: 'user', content: 'test' }], 100)).rejects.toThrow('spawn ENOENT');
  });
});

describe('extractText with ContentBlock arrays', () => {
  beforeEach(() => vi.clearAllMocks());

  it('handles ContentBlock array in messages', async () => {
    mockSpawnSuccess('response');
    const messages = [
      { role: 'user', content: [
        { type: 'text' as const, text: 'First part ' },
        { type: 'text' as const, text: 'second part' },
      ]},
    ];
    const result = await callClaudeCli(messages, 100);
    expect(result.content[0].text).toBe('response');
  });
});
