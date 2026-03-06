import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted ensures mockCreate is available inside the vi.mock factory (which is hoisted)
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock('openai', () => {
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
  (MockOpenAI as unknown as { APIError: typeof Error }).APIError = class APIError extends Error {
    status: number;
    constructor(msg: string, status = 500) { super(msg); this.status = status; }
  };
  return { default: MockOpenAI };
});

import OpenAI from 'openai';
import {
  callOpenRouterBackend,
  OPENROUTER_MESSAGES_URL,
  type BackendRequest,
} from '../../backends/openrouter-backend';

function makeCompletion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'msg_123',
    model: 'anthropic/claude-haiku',
    choices: [{
      finish_reason: 'stop',
      message: { role: 'assistant', content: 'Hello from model', tool_calls: [] },
    }],
    usage: { prompt_tokens: 10, completion_tokens: 20 },
    ...overrides,
  };
}

const baseReq: BackendRequest = {
  modelId: 'anthropic/claude-haiku',
  messages: [{ role: 'user', content: 'Hi' }],
  maxTokens: 100,
};

describe('callOpenRouterBackend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env['OPENROUTER_KEY'];
    mockCreate.mockResolvedValue(makeCompletion());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('posts to correct URL', async () => {
    await callOpenRouterBackend(baseReq);
    expect(vi.mocked(OpenAI)).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: expect.stringContaining('openrouter.ai') })
    );
    expect(OPENROUTER_MESSAGES_URL).toContain('openrouter.ai');
  });

  it('includes Authorization header when apiKey provided', async () => {
    await callOpenRouterBackend({ ...baseReq, apiKey: 'my-key' });
    expect(vi.mocked(OpenAI)).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'my-key' })
    );
  });

  it('uses OPENROUTER_KEY env var when no apiKey', async () => {
    process.env['OPENROUTER_KEY'] = 'env-key';
    await callOpenRouterBackend(baseReq);
    expect(vi.mocked(OpenAI)).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'env-key' })
    );
    delete process.env['OPENROUTER_KEY'];
  });

  it('omits Authorization header when no key available', async () => {
    await callOpenRouterBackend(baseReq);
    expect(vi.mocked(OpenAI)).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'no-key' })
    );
  });

  it('returns mapped AnthropicResponse', async () => {
    const result = await callOpenRouterBackend(baseReq);
    expect(result.id).toBe('msg_123');
    expect(result.type).toBe('message');
    expect(result.role).toBe('assistant');
    expect(result.content[0].text).toBe('Hello from model');
    expect(result.model).toBe('anthropic/claude-haiku');
    expect(result.stop_reason).toBe('end_turn');
    expect(result.stop_sequence).toBeNull();
    expect(result.usage.input_tokens).toBe(10);
    expect(result.usage.output_tokens).toBe(20);
  });

  it('defaults stop_reason to end_turn when missing', async () => {
    mockCreate.mockResolvedValue(makeCompletion({
      choices: [{ finish_reason: null, message: { role: 'assistant', content: 'Hi', tool_calls: [] } }],
    }));
    const result = await callOpenRouterBackend(baseReq);
    expect(result.stop_reason).toBe('end_turn');
  });

  it('defaults token counts to 0 when usage is missing', async () => {
    mockCreate.mockResolvedValue(makeCompletion({ usage: undefined }));
    const result = await callOpenRouterBackend(baseReq);
    expect(result.usage.input_tokens).toBe(0);
    expect(result.usage.output_tokens).toBe(0);
  });

  it('defaults token counts to 0 when usage fields are missing', async () => {
    mockCreate.mockResolvedValue(makeCompletion({ usage: {} }));
    const result = await callOpenRouterBackend(baseReq);
    expect(result.usage.input_tokens).toBe(0);
    expect(result.usage.output_tokens).toBe(0);
  });

  it('propagates errors', async () => {
    mockCreate.mockRejectedValue(new Error('Network error'));
    await expect(callOpenRouterBackend(baseReq)).rejects.toThrow('Network error');
  });

  it('converts system message as first message', async () => {
    await callOpenRouterBackend({ ...baseReq, system: 'You are helpful' });
    const params = mockCreate.mock.calls[0][0];
    expect(params.messages[0]).toEqual({ role: 'system', content: 'You are helpful' });
  });

  it('converts tool definitions to OpenAI format', async () => {
    const tools = [{ name: 'read', description: 'Read file', input_schema: { type: 'object', properties: { path: { type: 'string' } } } }];
    await callOpenRouterBackend({ ...baseReq, tools });
    const params = mockCreate.mock.calls[0][0];
    expect(params.tools).toHaveLength(1);
    expect(params.tools[0].type).toBe('function');
    expect(params.tools[0].function.name).toBe('read');
    expect(params.tools[0].function.description).toBe('Read file');
  });

  it('defaults description and schema for tools without them', async () => {
    const tools = [{ name: 'list_files' }];
    await callOpenRouterBackend({ ...baseReq, tools });
    const params = mockCreate.mock.calls[0][0];
    expect(params.tools[0].function.description).toBe('');
    expect(params.tools[0].function.parameters).toEqual({ type: 'object', properties: {} });
  });

  it('handles toolChoice type=any as required', async () => {
    const tools = [{ name: 'read', description: 'Read' }];
    await callOpenRouterBackend({ ...baseReq, tools, toolChoice: { type: 'any' } });
    const params = mockCreate.mock.calls[0][0];
    expect(params.tool_choice).toBe('required');
  });

  it('handles toolChoice type=tool with name', async () => {
    const tools = [{ name: 'read', description: 'Read' }];
    await callOpenRouterBackend({ ...baseReq, tools, toolChoice: { type: 'tool', name: 'read' } });
    const params = mockCreate.mock.calls[0][0];
    expect(params.tool_choice).toEqual({ type: 'function', function: { name: 'read' } });
  });

  it('handles toolChoice type=auto', async () => {
    const tools = [{ name: 'read', description: 'Read' }];
    await callOpenRouterBackend({ ...baseReq, tools, toolChoice: { type: 'auto' } });
    const params = mockCreate.mock.calls[0][0];
    expect(params.tool_choice).toBe('auto');
  });

  it('does not set tool_choice when no tools provided', async () => {
    await callOpenRouterBackend({ ...baseReq, toolChoice: { type: 'auto' } });
    const params = mockCreate.mock.calls[0][0];
    expect(params.tool_choice).toBeUndefined();
  });

  it('converts assistant tool_use messages to OpenAI tool_calls', async () => {
    await callOpenRouterBackend({
      ...baseReq,
      messages: [
        { role: 'user', content: 'Read a file' },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'I\'ll read it' },
            { type: 'tool_use', id: 'tu_1', name: 'read_file', input: { path: '/test' } },
          ],
        },
        {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'tu_1', content: 'file contents' },
          ],
        },
      ],
    });
    const params = mockCreate.mock.calls[0][0];
    const assistant = params.messages.find((m: { role: string }) => m.role === 'assistant');
    expect(assistant.tool_calls).toHaveLength(1);
    expect(assistant.tool_calls[0].function.name).toBe('read_file');
    expect(assistant.tool_calls[0].function.arguments).toBe('{"path":"/test"}');
    const tool = params.messages.find((m: { role: string }) => m.role === 'tool');
    expect(tool.content).toBe('file contents');
    expect(tool.tool_call_id).toBe('tu_1');
  });

  it('handles tool_result with ContentBlock array content', async () => {
    await callOpenRouterBackend({
      ...baseReq,
      messages: [
        { role: 'user', content: 'Use tool' },
        { role: 'assistant', content: [{ type: 'tool_use', id: 'tu_2', name: 'write', input: {} }] },
        {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'tu_2', content: [{ type: 'text', text: 'result text' }] },
          ],
        },
      ],
    });
    const params = mockCreate.mock.calls[0][0];
    const tool = params.messages.find((m: { role: string }) => m.role === 'tool');
    expect(tool.content).toBe('result text');
  });

  it('maps OpenAI tool_calls response to Anthropic format', async () => {
    mockCreate.mockResolvedValue({
      id: 'msg_tc',
      model: 'gpt-4',
      choices: [{
        finish_reason: 'stop',
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'call_1',
            type: 'function',
            function: { name: 'read_file', arguments: '{"path":"/test.ts"}' },
          }],
        },
      }],
      usage: { prompt_tokens: 15, completion_tokens: 25 },
    });

    const result = await callOpenRouterBackend(baseReq);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('tool_use');
    const toolBlock = result.content[0] as { type: string; name: string; input: unknown };
    expect(toolBlock.name).toBe('read_file');
    expect(toolBlock.input).toEqual({ path: '/test.ts' });
    expect(result.stop_reason).toBe('tool_use');
  });

  it('handles tool_call with malformed JSON arguments', async () => {
    mockCreate.mockResolvedValue({
      id: 'msg_bad_json',
      model: 'gpt-4',
      choices: [{
        finish_reason: 'stop',
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'call_2',
            type: 'function',
            function: { name: 'test', arguments: 'not json' },
          }],
        },
      }],
      usage: { prompt_tokens: 5, completion_tokens: 5 },
    });

    const result = await callOpenRouterBackend(baseReq);
    const toolBlock = result.content[0] as { type: string; input: unknown };
    expect(toolBlock.input).toEqual({});
  });

  it('handles tool_call without function field', async () => {
    mockCreate.mockResolvedValue({
      id: 'msg_no_fn',
      model: 'gpt-4',
      choices: [{
        finish_reason: 'stop',
        message: {
          role: 'assistant',
          content: 'text',
          tool_calls: [{ id: 'call_3', type: 'function' }],
        },
      }],
      usage: { prompt_tokens: 5, completion_tokens: 5 },
    });

    const result = await callOpenRouterBackend(baseReq);
    expect(result.content.some((b) => b.type === 'text')).toBe(true);
  });

  it('maps finish_reason=length to max_tokens', async () => {
    mockCreate.mockResolvedValue(makeCompletion({
      choices: [{ finish_reason: 'length', message: { role: 'assistant', content: 'Truncated', tool_calls: [] } }],
    }));
    const result = await callOpenRouterBackend(baseReq);
    expect(result.stop_reason).toBe('max_tokens');
  });

  it('generates id when completion has empty id', async () => {
    mockCreate.mockResolvedValue(makeCompletion({ id: '' }));
    const result = await callOpenRouterBackend(baseReq);
    expect(result.id).toMatch(/^msg_/);
  });

  it('falls back to modelId when completion has empty model', async () => {
    mockCreate.mockResolvedValue(makeCompletion({ model: '' }));
    const result = await callOpenRouterBackend(baseReq);
    expect(result.model).toBe('anthropic/claude-haiku');
  });

  it('marks quota exhausted on 429 API error', async () => {
    const MockAPIError = (OpenAI as unknown as { APIError: new (msg: string, status: number) => Error }).APIError;
    const apiError = new MockAPIError('Too many requests', 429);
    mockCreate.mockRejectedValue(apiError);
    await expect(callOpenRouterBackend(baseReq)).rejects.toThrow();
  });

  it('strips unsupported block types (e.g. thinking)', async () => {
    await callOpenRouterBackend({
      ...baseReq,
      messages: [
        { role: 'assistant', content: [
          { type: 'thinking', thinking: 'internal thought' } as unknown as import('../../../server/types').ContentBlock,
          { type: 'text', text: 'visible text' },
        ] },
        { role: 'user', content: 'Continue' },
      ],
    });
    const params = mockCreate.mock.calls[0][0];
    const assistant = params.messages.find((m: { role: string }) => m.role === 'assistant');
    expect(assistant.content).toBe('visible text');
  });

  it('handles user message with text and tool_result mixed', async () => {
    await callOpenRouterBackend({
      ...baseReq,
      messages: [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: [{ type: 'tool_use', id: 'tu_3', name: 'list', input: {} }] },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Here is the result' },
            { type: 'tool_result', tool_use_id: 'tu_3', content: 'data here' },
          ],
        },
      ],
    });
    const params = mockCreate.mock.calls[0][0];
    const toolMsgs = params.messages.filter((m: { role: string }) => m.role === 'tool');
    expect(toolMsgs).toHaveLength(1);
  });

  it('handles whitespace-only user text blocks (no user message emitted)', async () => {
    await callOpenRouterBackend({
      ...baseReq,
      messages: [
        { role: 'user', content: [{ type: 'text', text: '   ' }] },
      ],
    });
    const params = mockCreate.mock.calls[0][0];
    const userMsgs = params.messages.filter((m: { role: string }) => m.role === 'user');
    expect(userMsgs).toHaveLength(0);
  });
});
