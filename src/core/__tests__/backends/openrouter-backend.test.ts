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
});
