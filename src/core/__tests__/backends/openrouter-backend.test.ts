import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('axios');

import axios from 'axios';
import {
  callOpenRouterBackend,
  OPENROUTER_MESSAGES_URL,
  type BackendRequest,
} from '../../backends/openrouter-backend';

const mockedAxios = vi.mocked(axios);

function makeResp(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello from model' }],
      model: 'anthropic/claude-haiku',
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 20 },
      ...overrides,
    },
  };
}

const baseReq: BackendRequest = {
  modelId: 'anthropic/claude-haiku',
  messages: [{ role: 'user', content: 'Hi' }],
  maxTokens: 100,
};

describe('callOpenRouterBackend', () => {
  beforeEach(() => {
    delete process.env['OPENROUTER_KEY'];
    mockedAxios.post = vi.fn().mockResolvedValue(makeResp());
    mockedAxios.isAxiosError = vi.fn().mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('posts to correct URL', async () => {
    await callOpenRouterBackend(baseReq);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      OPENROUTER_MESSAGES_URL,
      expect.objectContaining({ model: 'anthropic/claude-haiku', max_tokens: 100 }),
      expect.any(Object)
    );
  });

  it('includes Authorization header when apiKey provided', async () => {
    await callOpenRouterBackend({ ...baseReq, apiKey: 'my-key' });
    const headers = (mockedAxios.post as ReturnType<typeof vi.fn>).mock.calls[0][2].headers;
    expect(headers['Authorization']).toBe('Bearer my-key');
  });

  it('uses OPENROUTER_KEY env var when no apiKey', async () => {
    process.env['OPENROUTER_KEY'] = 'env-key';
    await callOpenRouterBackend(baseReq);
    const headers = (mockedAxios.post as ReturnType<typeof vi.fn>).mock.calls[0][2].headers;
    expect(headers['Authorization']).toBe('Bearer env-key');
    delete process.env['OPENROUTER_KEY'];
  });

  it('omits Authorization header when no key available', async () => {
    await callOpenRouterBackend(baseReq);
    const headers = (mockedAxios.post as ReturnType<typeof vi.fn>).mock.calls[0][2].headers;
    expect(headers['Authorization']).toBeUndefined();
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
    mockedAxios.post = vi.fn().mockResolvedValue({
      data: {
        content: [{ type: 'text', text: 'Hi' }],
        usage: { input_tokens: 5, output_tokens: 5 },
      },
    });
    const result = await callOpenRouterBackend(baseReq);
    expect(result.stop_reason).toBe('end_turn');
  });

  it('defaults token counts to 0 when usage is missing', async () => {
    mockedAxios.post = vi.fn().mockResolvedValue({
      data: {
        content: [{ type: 'text', text: 'Hi' }],
        // no usage field
      },
    });
    const result = await callOpenRouterBackend(baseReq);
    expect(result.usage.input_tokens).toBe(0);
    expect(result.usage.output_tokens).toBe(0);
  });

  it('defaults token counts to 0 when usage fields are missing', async () => {
    mockedAxios.post = vi.fn().mockResolvedValue({
      data: {
        content: [{ type: 'text', text: 'Hi' }],
        usage: {},
      },
    });
    const result = await callOpenRouterBackend(baseReq);
    expect(result.usage.input_tokens).toBe(0);
    expect(result.usage.output_tokens).toBe(0);
  });

  it('propagates axios errors', async () => {
    mockedAxios.post = vi.fn().mockRejectedValue(new Error('Network error'));
    await expect(callOpenRouterBackend(baseReq)).rejects.toThrow('Network error');
  });
});
