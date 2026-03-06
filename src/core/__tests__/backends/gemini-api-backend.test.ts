import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('axios');
vi.mock('../../quota-manager', () => ({
  quotaManager: {
    markAvailable: vi.fn(),
    markExhausted: vi.fn(),
    isExhausted: vi.fn().mockReturnValue(false),
  },
}));

import axios from 'axios';
import { quotaManager } from '../../quota-manager';
import { hasGeminiCredentials, callGeminiApiBackend } from '../../backends/gemini-api-backend';
import type { GeminiApiRequest } from '../../backends/gemini-api-backend';

const originalEnv = process.env;

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...originalEnv, GEMINI_API_KEY: 'test-key' };
});

afterEach(() => {
  process.env = originalEnv;
});

describe('hasGeminiCredentials', () => {
  it('returns true when GEMINI_API_KEY is set', () => {
    process.env['GEMINI_API_KEY'] = 'test';
    expect(hasGeminiCredentials()).toBe(true);
  });

  it('returns true when GOOGLE_API_KEY is set', () => {
    delete process.env['GEMINI_API_KEY'];
    process.env['GOOGLE_API_KEY'] = 'test';
    expect(hasGeminiCredentials()).toBe(true);
  });

  it('returns false when no key is set', () => {
    delete process.env['GEMINI_API_KEY'];
    delete process.env['GOOGLE_API_KEY'];
    expect(hasGeminiCredentials()).toBe(false);
  });
});

describe('callGeminiApiBackend', () => {
  const baseReq: GeminiApiRequest = {
    messages: [{ role: 'user', content: 'Hello' }],
    maxTokens: 100,
  };

  function mockAxiosResponse(parts: Array<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> } }>, finishReason = 'STOP') {
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        candidates: [{
          content: { parts, role: 'model' },
          finishReason,
        }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
      },
    });
  }

  it('throws when no API key is set', async () => {
    delete process.env['GEMINI_API_KEY'];
    delete process.env['GOOGLE_API_KEY'];
    await expect(callGeminiApiBackend(baseReq)).rejects.toThrow('GEMINI_API_KEY not set');
  });

  it('returns text response', async () => {
    mockAxiosResponse([{ text: 'Hello from Gemini' }]);

    const result = await callGeminiApiBackend(baseReq);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toBe('Hello from Gemini');
    expect(result.stop_reason).toBe('end_turn');
    expect(result.usage.input_tokens).toBe(10);
    expect(result.usage.output_tokens).toBe(20);
    expect(quotaManager.markAvailable).toHaveBeenCalled();
  });

  it('returns tool_use response', async () => {
    mockAxiosResponse([
      { functionCall: { name: 'read_file', args: { path: '/test.ts' } } },
    ]);

    const result = await callGeminiApiBackend(baseReq);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('tool_use');
    const toolBlock = result.content[0] as { type: string; id: string; name: string; input: unknown };
    expect(toolBlock.name).toBe('read_file');
    expect(toolBlock.input).toEqual({ path: '/test.ts' });
    expect(result.stop_reason).toBe('tool_use');
  });

  it('handles MAX_TOKENS finish reason', async () => {
    mockAxiosResponse([{ text: 'Truncated...' }], 'MAX_TOKENS');
    const result = await callGeminiApiBackend(baseReq);
    expect(result.stop_reason).toBe('max_tokens');
  });

  it('includes system instruction when provided', async () => {
    mockAxiosResponse([{ text: 'OK' }]);

    await callGeminiApiBackend({ ...baseReq, system: 'You are helpful' });

    expect(axios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        systemInstruction: { parts: [{ text: 'You are helpful' }] },
      }),
      expect.any(Object)
    );
  });

  it('converts and includes tools when provided', async () => {
    mockAxiosResponse([{ text: 'OK' }]);

    const tools = [{ name: 'read', description: 'Read file', input_schema: { type: 'object' } }];
    await callGeminiApiBackend({ ...baseReq, tools });

    expect(axios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        tools: [{ functionDeclarations: [{ name: 'read', description: 'Read file', parameters: { type: 'object' } }] }],
      }),
      expect.any(Object)
    );
  });

  it('converts tool_use and tool_result message blocks', async () => {
    mockAxiosResponse([{ text: 'Done' }]);

    await callGeminiApiBackend({
      messages: [
        { role: 'user', content: 'Read a file' },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'I\'ll read the file' },
            { type: 'tool_use', id: 'tu_1', name: 'read_file', input: { path: '/test.ts' } },
          ],
        },
        {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'tu_1', content: 'file content here' },
          ],
        },
      ],
      maxTokens: 100,
    });

    const call = vi.mocked(axios.post).mock.calls[0];
    const body = call[1] as { contents: Array<{ role: string; parts: Array<{ text?: string; functionCall?: unknown; functionResponse?: unknown }> }> };
    // assistant message should have functionCall
    const assistantParts = body.contents.find(c => c.role === 'model')!.parts;
    expect(assistantParts.some(p => p.functionCall !== undefined)).toBe(true);
    // user message with tool_result should have functionResponse
    const userParts = body.contents.filter(c => c.role === 'user');
    const lastUserParts = userParts[userParts.length - 1].parts;
    expect(lastUserParts.some(p => p.functionResponse !== undefined)).toBe(true);
  });

  it('handles tool_result with array content', async () => {
    mockAxiosResponse([{ text: 'Done' }]);

    await callGeminiApiBackend({
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
      maxTokens: 100,
    });

    expect(axios.post).toHaveBeenCalled();
  });

  it('marks quota exhausted on 429 error', async () => {
    const error = new Error('Rate limited') as Error & { response?: { status: number }; isAxiosError?: boolean };
    error.response = { status: 429 };
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.post).mockRejectedValue(error);

    await expect(callGeminiApiBackend(baseReq)).rejects.toThrow();
    expect(quotaManager.markExhausted).toHaveBeenCalled();
  });

  it('rethrows non-429 errors without marking exhausted', async () => {
    const error = new Error('Server error') as Error & { response?: { status: number } };
    error.response = { status: 500 };
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.post).mockRejectedValue(error);

    await expect(callGeminiApiBackend(baseReq)).rejects.toThrow('Server error');
    expect(quotaManager.markExhausted).not.toHaveBeenCalled();
  });

  it('handles response with empty parts', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        candidates: [{ content: { parts: [], role: 'model' }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 0 },
      },
    });

    const result = await callGeminiApiBackend(baseReq);
    expect(result.content).toHaveLength(0);
    expect(result.stop_reason).toBe('end_turn');
  });

  it('handles response with no candidates', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: { candidates: [], usageMetadata: {} },
    });

    const result = await callGeminiApiBackend(baseReq);
    expect(result.content).toHaveLength(0);
  });

  it('handles empty text parts (skips them)', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        candidates: [{ content: { parts: [{ text: '' }], role: 'model' }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 0 },
      },
    });

    const result = await callGeminiApiBackend(baseReq);
    expect(result.content).toHaveLength(0);
  });

  it('handles functionCall with no args', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        candidates: [{
          content: {
            parts: [{ functionCall: { name: 'list_files', args: undefined } }],
            role: 'model',
          },
          finishReason: 'STOP',
        }],
        usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 10 },
      },
    });

    const result = await callGeminiApiBackend(baseReq);
    expect(result.content).toHaveLength(1);
    const toolBlock = result.content[0] as { type: string; input: unknown };
    expect(toolBlock.input).toEqual({});
  });

  it('converts messages with empty string content to empty text part', async () => {
    mockAxiosResponse([{ text: 'OK' }]);

    await callGeminiApiBackend({
      messages: [{ role: 'user', content: '   ' }],
      maxTokens: 100,
    });

    const call = vi.mocked(axios.post).mock.calls[0];
    const body = call[1] as { contents: Array<{ parts: Array<{ text?: string }> }> };
    // Empty/whitespace content should result in a fallback empty text part
    expect(body.contents[0].parts).toHaveLength(1);
  });

  it('handles tool_result with unknown tool_use_id', async () => {
    mockAxiosResponse([{ text: 'OK' }]);

    await callGeminiApiBackend({
      messages: [
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'unknown_id', content: 'data' }] },
      ],
      maxTokens: 100,
    });

    const call = vi.mocked(axios.post).mock.calls[0];
    const body = call[1] as { contents: Array<{ parts: Array<{ functionResponse?: { name: string } }> }> };
    const fr = body.contents[0].parts.find(p => p.functionResponse);
    expect(fr?.functionResponse?.name).toBe('unknown_tool');
  });

  it('does not include tools when empty array provided', async () => {
    mockAxiosResponse([{ text: 'OK' }]);
    await callGeminiApiBackend({ ...baseReq, tools: [] });

    const call = vi.mocked(axios.post).mock.calls[0];
    const body = call[1] as Record<string, unknown>;
    expect(body['tools']).toBeUndefined();
  });
});
