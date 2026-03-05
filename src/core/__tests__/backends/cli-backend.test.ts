import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock child_process before importing cli-backend
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

// Mock quota-manager to avoid exhaustion checks
vi.mock('../../../core/quota-manager', () => ({
  quotaManager: {
    isExhausted: vi.fn().mockReturnValue(false),
    markAvailable: vi.fn(),
    markExhausted: vi.fn(),
  },
}));

import { exec } from 'child_process';
import { detectCliTool, callClaudeCli, callGeminiCli } from '../../backends/cli-backend';

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

/** Returns the full command string from the last exec call. */
function getLastCommand(): string {
  return vi.mocked(exec).mock.calls[0]?.[0] as string ?? '';
}

/** Returns the options object from the last exec call. */
function getLastOptions(): { env?: NodeJS.ProcessEnv } {
  return (vi.mocked(exec).mock.calls[0]?.[1] ?? {}) as { env?: NodeJS.ProcessEnv };
}

// Clear CLAUDECODE env for tests
beforeEach(() => {
  delete process.env['CLAUDECODE'];
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
});

describe('callClaudeCli', () => {
  const messages = [
    { role: 'system', content: 'You are helpful' },
    { role: 'user', content: 'Hello' },
  ];

  beforeEach(() => vi.clearAllMocks());

  it('returns AnthropicResponse on success with plain text output', async () => {
    mockExecSuccess('  Claude response text  ');
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
    mockExecSuccess(jsonOutput);
    const result = await callClaudeCli(messages, 100);
    expect(result.content[0].text).toBe('Parsed from JSON');
  });

  it('falls back to raw stdout when JSON is_error is not a string result', async () => {
    const jsonOutput = JSON.stringify({ type: 'result', is_error: true });
    mockExecSuccess(jsonOutput);
    const result = await callClaudeCli(messages, 100);
    // result field is absent → falls back to raw stdout
    expect(result.content[0].text).toBe(jsonOutput.trim());
  });

  it('calls claude with required non-interactive flags and prompt', async () => {
    mockExecSuccess('output');
    await callClaudeCli(messages, 500);
    const cmd = getLastCommand();
    expect(cmd).toContain('claude');
    expect(cmd).toContain('-p');
    expect(cmd).toContain('--output-format');
    expect(cmd).toContain('json');
    expect(cmd).toContain('--dangerously-skip-permissions');
    expect(cmd).toContain('--no-session-persistence');
    expect(cmd).toContain('Hello');
  });

  it('calls claude without CLAUDECODE env var', async () => {
    process.env['CLAUDECODE'] = 'some-session-id';
    mockExecSuccess('output');
    await callClaudeCli(messages, 100);
    const opts = getLastOptions();
    expect(opts?.env?.['CLAUDECODE']).toBeUndefined();
    delete process.env['CLAUDECODE'];
  });

  it('calls claude without ANTHROPIC_BASE_URL env var', async () => {
    process.env['ANTHROPIC_BASE_URL'] = 'http://localhost:3000';
    mockExecSuccess('output');
    await callClaudeCli(messages, 100);
    const opts = getLastOptions();
    expect(opts?.env?.['ANTHROPIC_BASE_URL']).toBeUndefined();
    delete process.env['ANTHROPIC_BASE_URL'];
  });

  it('uses last user message as prompt', async () => {
    mockExecSuccess('response');
    const msgs = [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'reply' },
      { role: 'user', content: 'second question' },
    ];
    await callClaudeCli(msgs, 100);
    const cmd = getLastCommand();
    expect(cmd).toContain('second question');
  });

  it('uses empty string when no user messages', async () => {
    mockExecSuccess('response');
    await callClaudeCli([{ role: 'system', content: 'sys' }], 100);
    const cmd = getLastCommand();
    expect(cmd).toContain('claude');
    expect(cmd).toContain('-p');
  });

  it('propagates errors', async () => {
    mockExecError('claude not found');
    await expect(callClaudeCli(messages, 100)).rejects.toThrow('claude not found');
  });
});

describe('callGeminiCli', () => {
  const messages = [{ role: 'user', content: 'Tell me about AI' }];

  beforeEach(() => vi.clearAllMocks());

  it('returns AnthropicResponse on success', async () => {
    mockExecSuccess('  Gemini response  ');
    const result = await callGeminiCli(messages, 200);
    expect(result.id).toMatch(/^msg_/);
    expect(result.content[0].text).toBe('Gemini response');
    expect(result.model).toBe('gemini-cli');
    expect(result.stop_reason).toBe('end_turn');
    expect(result.usage).toEqual({ input_tokens: 0, output_tokens: 0 });
  });

  it('calls gemini with -p flag and prompt', async () => {
    mockExecSuccess('output');
    await callGeminiCli(messages, 300);
    const cmd = getLastCommand();
    expect(cmd).toContain('gemini');
    expect(cmd).toContain('-p');
    expect(cmd).toContain('Tell me about AI');
  });

  it('propagates errors', async () => {
    mockExecError('gemini not found');
    await expect(callGeminiCli(messages, 100)).rejects.toThrow('gemini not found');
  });
});
