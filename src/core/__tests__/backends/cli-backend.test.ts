import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

import { execFile } from 'child_process';
import { detectCliTool, callClaudeCli, callGeminiCli } from '../../backends/cli-backend';

type ExecFileCallback = (err: Error | null, stdout: string, stderr: string) => void;

function mockExecSuccess(output: string) {
  vi.mocked(execFile).mockImplementation((...args) => {
    const cb = args.find((a) => typeof a === 'function') as ExecFileCallback;
    process.nextTick(() => cb(null, output, ''));
    return {} as ReturnType<typeof execFile>;
  });
}

function mockExecError(message: string) {
  vi.mocked(execFile).mockImplementation((...args) => {
    const cb = args.find((a) => typeof a === 'function') as ExecFileCallback;
    process.nextTick(() => cb(new Error(message), '', ''));
    return {} as ReturnType<typeof execFile>;
  });
}

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

  it('returns AnthropicResponse on success', async () => {
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

  it('calls claude with -p flag and prompt', async () => {
    mockExecSuccess('output');
    await callClaudeCli(messages, 500);
    const callArgs = vi.mocked(execFile).mock.calls[0] as unknown[];
    expect(callArgs[0]).toBe('claude');
    expect(callArgs[1]).toContain('-p');
    expect(callArgs[1]).toContain('Hello');
  });

  it('calls claude without CLAUDECODE env var', async () => {
    process.env['CLAUDECODE'] = 'some-session-id';
    mockExecSuccess('output');
    await callClaudeCli(messages, 100);
    const callOpts = vi.mocked(execFile).mock.calls[0][2] as { env?: NodeJS.ProcessEnv };
    expect(callOpts?.env?.['CLAUDECODE']).toBeUndefined();
    delete process.env['CLAUDECODE'];
  });

  it('uses last user message as prompt', async () => {
    mockExecSuccess('response');
    const msgs = [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'reply' },
      { role: 'user', content: 'second question' },
    ];
    await callClaudeCli(msgs, 100);
    const callArgs = vi.mocked(execFile).mock.calls[0][1] as string[];
    expect(callArgs).toContain('second question');
  });

  it('uses empty string when no user messages', async () => {
    mockExecSuccess('response');
    await callClaudeCli([{ role: 'system', content: 'sys' }], 100);
    const callArgs = vi.mocked(execFile).mock.calls[0][1] as string[];
    expect(callArgs[callArgs.length - 1]).toBe('');
  });

  it('propagates execFile errors', async () => {
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

  it('calls gemini with prompt and max-output-tokens', async () => {
    mockExecSuccess('output');
    await callGeminiCli(messages, 300);
    const callArgs = vi.mocked(execFile).mock.calls[0] as unknown[];
    expect(callArgs[0]).toBe('gemini');
    expect(callArgs[1]).toContain('Tell me about AI');
    expect(callArgs[1]).toContain('300');
  });

  it('propagates execFile errors', async () => {
    mockExecError('gemini not found');
    await expect(callGeminiCli(messages, 100)).rejects.toThrow('gemini not found');
  });
});
