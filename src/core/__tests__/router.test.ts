import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Model } from '../../registry/model-registry';
import type { AnthropicResponse } from '../../server/types';

vi.mock('../selection-algorithm');
vi.mock('../backends/openrouter-backend');
vi.mock('../backends/cli-backend');
vi.mock('../backends/gemini-api-backend');
vi.mock('../backend-preference');

import { selectModel } from '../selection-algorithm';
import { callOpenRouterBackend } from '../backends/openrouter-backend';
import { detectCliTool, callClaudeCli, callGeminiCli, callCursorCli } from '../backends/cli-backend';
import { hasGeminiCredentials, callGeminiApiBackend } from '../backends/gemini-api-backend';
import { getForcedBackend } from '../backend-preference';
import { routeRequest, extractText } from '../router';

function makeModel(overrides: Partial<Model> = {}): Model {
  return {
    id: 'test/model',
    name: 'Test Model',
    tier: 'cheap',
    provider: 'openrouter',
    costPer1kTokens: { input: 0.001, output: 0.002 },
    contextWindow: 8192,
    categories: ['code'],
    enabled: true,
    ...overrides,
  };
}

function makeResponse(text = 'Hello'): AnthropicResponse {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text }],
    model: 'test/model',
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 5, output_tokens: 10 },
  };
}

const baseReq = {
  messages: [{ role: 'user', content: 'Write a function to sort an array' }],
  maxTokens: 500,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(detectCliTool).mockResolvedValue(false);
  vi.mocked(callOpenRouterBackend).mockResolvedValue(makeResponse());
  vi.mocked(getForcedBackend).mockReturnValue('auto');
  vi.mocked(hasGeminiCredentials).mockReturnValue(false);
  vi.mocked(callGeminiApiBackend).mockResolvedValue(makeResponse('Gemini API'));
  vi.mocked(selectModel).mockReturnValue({
    model: makeModel(),
    fallbackChain: [],
    confidence: 0.8,
    reasoning: 'test selection',
  });
});

describe('routeRequest', () => {
  it('routes to OpenRouter for generic model', async () => {
    const result = await routeRequest(baseReq);
    expect(callOpenRouterBackend).toHaveBeenCalledWith({
      modelId: 'test/model',
      messages: baseReq.messages,
      maxTokens: 500,
    });
    expect(result.backend).toBe('openrouter');
    expect(result.selectedModel).toBe('test/model');
    expect(result.attempts).toBe(1);
  });

  it('returns response with timestamp from handler', async () => {
    const result = await routeRequest(baseReq);
    expect(result.response.content[0].text).toBe('Hello');
  });

  it('passes preferredModel to selectModel', async () => {
    await routeRequest({ ...baseReq, preferredModel: 'openai/gpt-4' });
    expect(selectModel).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ preferredModels: ['openai/gpt-4'] })
    );
  });

  it('passes blacklistedModels to selectModel', async () => {
    await routeRequest({ ...baseReq, blacklistedModels: ['bad/model'] });
    expect(selectModel).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ blacklistedModels: ['bad/model'] })
    );
  });

  it('uses undefined preferredModels when no preferredModel set', async () => {
    await routeRequest(baseReq);
    expect(selectModel).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ preferredModels: undefined })
    );
  });

  it('routes to claude-cli for anthropic model when claude is available', async () => {
    vi.mocked(selectModel).mockReturnValue({
      model: makeModel({ id: 'anthropic/claude-haiku', provider: 'anthropic' }),
      fallbackChain: [],
      confidence: 0.9,
      reasoning: 'anthropic',
    });
    vi.mocked(detectCliTool).mockImplementation((tool) =>
      Promise.resolve(tool === 'claude')
    );
    vi.mocked(callClaudeCli).mockResolvedValue(makeResponse('Claude CLI response'));

    const result = await routeRequest(baseReq);
    expect(result.backend).toBe('claude-cli');
    // New router: selectedModel is 'claude-cli' (CLIs take priority regardless of provider)
    expect(result.selectedModel).toBe('claude-cli');
    expect(callOpenRouterBackend).not.toHaveBeenCalled();
  });

  it('falls back to OpenRouter when claude-cli fails', async () => {
    vi.mocked(selectModel).mockReturnValue({
      model: makeModel({ id: 'anthropic/claude-haiku', provider: 'anthropic' }),
      fallbackChain: [],
      confidence: 0.9,
      reasoning: 'anthropic',
    });
    vi.mocked(detectCliTool).mockResolvedValue(true);
    vi.mocked(callClaudeCli).mockRejectedValue(new Error('CLI failed'));
    // Also make gemini and cursor fail so routing falls through to OpenRouter
    vi.mocked(callGeminiCli).mockRejectedValue(new Error('CLI failed'));
    vi.mocked(callCursorCli).mockRejectedValue(new Error('CLI failed'));
    vi.mocked(callOpenRouterBackend).mockResolvedValue(makeResponse('OpenRouter fallback'));

    const result = await routeRequest(baseReq);
    expect(result.backend).toBe('openrouter');
  });

  it('routes to gemini-cli for google model when gemini is available', async () => {
    vi.mocked(selectModel).mockReturnValue({
      model: makeModel({ id: 'google/gemini-flash', provider: 'google' }),
      fallbackChain: [],
      confidence: 0.85,
      reasoning: 'google',
    });
    vi.mocked(detectCliTool).mockImplementation((tool) =>
      Promise.resolve(tool === 'gemini')
    );
    vi.mocked(callGeminiCli).mockResolvedValue(makeResponse('Gemini CLI response'));

    const result = await routeRequest(baseReq);
    expect(result.backend).toBe('gemini-cli');
    // New router: selectedModel is 'gemini-cli' (CLIs take priority regardless of provider)
    expect(result.selectedModel).toBe('gemini-cli');
    expect(callOpenRouterBackend).not.toHaveBeenCalled();
  });

  it('falls back to OpenRouter when gemini-cli fails', async () => {
    vi.mocked(selectModel).mockReturnValue({
      model: makeModel({ id: 'google/gemini-flash', provider: 'google' }),
      fallbackChain: [],
      confidence: 0.85,
      reasoning: 'google',
    });
    vi.mocked(detectCliTool).mockResolvedValue(true);
    vi.mocked(callClaudeCli).mockRejectedValue(new Error('CLI failed'));
    vi.mocked(callGeminiCli).mockRejectedValue(new Error('Gemini CLI failed'));
    vi.mocked(callCursorCli).mockRejectedValue(new Error('CLI failed'));
    vi.mocked(callOpenRouterBackend).mockResolvedValue(makeResponse('OpenRouter fallback'));

    const result = await routeRequest(baseReq);
    expect(result.backend).toBe('openrouter');
  });

  it('tries next model in fallback chain when first model fails', async () => {
    const primaryModel = makeModel({ id: 'primary/model', provider: 'openrouter' });
    const fallbackModel = makeModel({ id: 'fallback/model', provider: 'openrouter' });

    vi.mocked(selectModel).mockReturnValue({
      model: primaryModel,
      fallbackChain: [fallbackModel],
      confidence: 0.7,
      reasoning: 'fallback test',
    });

    vi.mocked(callOpenRouterBackend)
      .mockRejectedValueOnce(new Error('Primary failed'))
      .mockResolvedValueOnce(makeResponse('Fallback response'));

    const result = await routeRequest(baseReq);
    expect(result.selectedModel).toBe('fallback/model');
    expect(result.attempts).toBe(2);
  });

  it('throws when all backends exhausted and no CLI available', async () => {
    const primary = makeModel({ id: 'a/model' });
    const fallback = makeModel({ id: 'b/model' });

    vi.mocked(selectModel).mockReturnValue({
      model: primary,
      fallbackChain: [fallback],
      confidence: 0.5,
      reasoning: 'all fail',
    });
    vi.mocked(callOpenRouterBackend).mockRejectedValue(new Error('All fail'));
    vi.mocked(detectCliTool).mockResolvedValue(false);

    await expect(routeRequest(baseReq)).rejects.toThrow('All routing backends exhausted');
  });

  it('uses claude-cli first when available (no need for OpenRouter fallback)', async () => {
    vi.mocked(selectModel).mockReturnValue({
      model: makeModel({ id: 'openrouter/some-model', provider: 'openrouter' }),
      fallbackChain: [],
      confidence: 0.5,
      reasoning: 'test',
    });
    vi.mocked(detectCliTool).mockResolvedValue(true);
    vi.mocked(callClaudeCli).mockResolvedValue(makeResponse('CLI response'));

    const result = await routeRequest(baseReq);
    expect(result.backend).toBe('claude-cli');
    expect(result.selectedModel).toBe('claude-cli');
    // CLIs have priority 1 — OpenRouter is never called
    expect(result.attempts).toBe(1);
    expect(callOpenRouterBackend).not.toHaveBeenCalled();
  });

  it('concatenates all message contents as prompt for selectModel', async () => {
    await routeRequest({
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
        { role: 'user', content: 'How are you?' },
      ],
      maxTokens: 100,
    });
    expect(selectModel).toHaveBeenCalledWith(
      'Hello\nHi there\nHow are you?',
      expect.any(Object)
    );
  });

  it('skips CLIs when messages contain tool_result', async () => {
    vi.mocked(detectCliTool).mockResolvedValue(true);
    vi.mocked(callClaudeCli).mockResolvedValue(makeResponse('CLI'));
    vi.mocked(hasGeminiCredentials).mockReturnValue(false);

    const result = await routeRequest({
      messages: [
        { role: 'user', content: 'Use tool' },
        { role: 'assistant', content: [{ type: 'tool_use', id: 'tu_1', name: 'test', input: {} }] },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: 'result' }] },
      ],
      maxTokens: 100,
    });
    // CLI should be skipped, fallback to openrouter
    expect(callClaudeCli).not.toHaveBeenCalled();
    expect(result.backend).toBe('openrouter');
  });

  it('skips CLIs when last assistant used tool_use', async () => {
    vi.mocked(detectCliTool).mockResolvedValue(true);
    vi.mocked(callClaudeCli).mockResolvedValue(makeResponse('CLI'));
    vi.mocked(hasGeminiCredentials).mockReturnValue(false);

    const result = await routeRequest({
      messages: [
        { role: 'user', content: 'Read file' },
        { role: 'assistant', content: [{ type: 'tool_use', id: 'tu_1', name: 'read', input: {} }] },
      ],
      maxTokens: 100,
    });
    expect(callClaudeCli).not.toHaveBeenCalled();
    expect(result.backend).toBe('openrouter');
  });

  it('routes to gemini-api when credentials are available (auto mode)', async () => {
    vi.mocked(detectCliTool).mockResolvedValue(false);
    vi.mocked(hasGeminiCredentials).mockReturnValue(true);

    const result = await routeRequest(baseReq);
    expect(result.backend).toBe('gemini-api');
    expect(callOpenRouterBackend).not.toHaveBeenCalled();
  });

  it('falls through to openrouter when gemini-api fails', async () => {
    vi.mocked(detectCliTool).mockResolvedValue(false);
    vi.mocked(hasGeminiCredentials).mockReturnValue(true);
    vi.mocked(callGeminiApiBackend).mockRejectedValue(new Error('API error'));

    const result = await routeRequest(baseReq);
    expect(result.backend).toBe('openrouter');
  });

  it('routes to cursor-cli when available and claude/gemini fail', async () => {
    vi.mocked(detectCliTool).mockResolvedValue(true);
    vi.mocked(callClaudeCli).mockRejectedValue(new Error('fail'));
    vi.mocked(callGeminiCli).mockRejectedValue(new Error('fail'));
    vi.mocked(callCursorCli).mockResolvedValue(makeResponse('Cursor'));

    const result = await routeRequest(baseReq);
    expect(result.backend).toBe('cursor-cli');
    expect(result.selectedModel).toBe('cursor-cli');
  });
});

describe('forced backend mode', () => {
  it('forces claude-cli backend', async () => {
    vi.mocked(getForcedBackend).mockReturnValue('claude-cli');
    vi.mocked(callClaudeCli).mockResolvedValue(makeResponse('Forced Claude'));

    const result = await routeRequest(baseReq);
    expect(result.backend).toBe('claude-cli');
    expect(result.selectedModel).toBe('claude-cli');
  });

  it('forces gemini-cli backend', async () => {
    vi.mocked(getForcedBackend).mockReturnValue('gemini-cli');
    vi.mocked(callGeminiCli).mockResolvedValue(makeResponse('Forced Gemini'));

    const result = await routeRequest(baseReq);
    expect(result.backend).toBe('gemini-cli');
    expect(result.selectedModel).toBe('gemini-cli');
  });

  it('forces cursor-cli backend', async () => {
    vi.mocked(getForcedBackend).mockReturnValue('cursor-cli');
    vi.mocked(callCursorCli).mockResolvedValue(makeResponse('Forced Cursor'));

    const result = await routeRequest(baseReq);
    expect(result.backend).toBe('cursor-cli');
    expect(result.selectedModel).toBe('cursor-cli');
  });

  it('forces gemini-api backend', async () => {
    vi.mocked(getForcedBackend).mockReturnValue('gemini-api');
    vi.mocked(callGeminiApiBackend).mockResolvedValue(makeResponse('Forced Gemini API'));

    const result = await routeRequest(baseReq);
    expect(result.backend).toBe('gemini-api');
    expect(result.selectedModel).toBe('gemini-api');
  });

  it('forces openrouter backend', async () => {
    vi.mocked(getForcedBackend).mockReturnValue('openrouter');
    vi.mocked(callOpenRouterBackend).mockResolvedValue(makeResponse('Forced OR'));

    const result = await routeRequest(baseReq);
    expect(result.backend).toBe('openrouter');
  });

  it('falls through to auto mode when forced backend fails', async () => {
    vi.mocked(getForcedBackend).mockReturnValue('claude-cli');
    vi.mocked(callClaudeCli).mockRejectedValue(new Error('Forced failed'));
    vi.mocked(detectCliTool).mockResolvedValue(false);
    vi.mocked(callOpenRouterBackend).mockResolvedValue(makeResponse('Auto fallback'));

    const result = await routeRequest(baseReq);
    expect(result.backend).toBe('openrouter');
  });

  it('falls through to auto when forced fails with stderr', async () => {
    vi.mocked(getForcedBackend).mockReturnValue('gemini-cli');
    const err = new Error('fail') as Error & { stderr: string };
    err.stderr = 'some stderr output';
    vi.mocked(callGeminiCli).mockRejectedValue(err);
    vi.mocked(detectCliTool).mockResolvedValue(false);
    vi.mocked(callOpenRouterBackend).mockResolvedValue(makeResponse('Fallback'));

    const result = await routeRequest(baseReq);
    expect(result.backend).toBe('openrouter');
  });

  it('passes system/tools/toolChoice to forced gemini-api', async () => {
    vi.mocked(getForcedBackend).mockReturnValue('gemini-api');
    vi.mocked(callGeminiApiBackend).mockResolvedValue(makeResponse('Gemini'));

    await routeRequest({
      ...baseReq,
      system: 'You are a helper',
      tools: [{ name: 'read', description: 'Read file', input_schema: {} }],
      toolChoice: { type: 'auto' },
    });

    expect(callGeminiApiBackend).toHaveBeenCalledWith(expect.objectContaining({
      system: 'You are a helper',
      tools: expect.any(Array),
      toolChoice: { type: 'auto' },
    }));
  });

  it('passes system/tools/toolChoice to forced openrouter', async () => {
    vi.mocked(getForcedBackend).mockReturnValue('openrouter');
    vi.mocked(callOpenRouterBackend).mockResolvedValue(makeResponse('OR'));

    await routeRequest({
      ...baseReq,
      system: 'Be helpful',
      tools: [{ name: 'write' }],
      toolChoice: { type: 'any' },
    });

    expect(callOpenRouterBackend).toHaveBeenCalledWith(expect.objectContaining({
      system: 'Be helpful',
      tools: expect.any(Array),
      toolChoice: { type: 'any' },
    }));
  });
});

describe('non-Error throws (branch coverage)', () => {
  it('handles non-Error throw in CLI failure path', async () => {
    vi.mocked(detectCliTool).mockResolvedValue(true);
    vi.mocked(callClaudeCli).mockRejectedValue('string error');
    vi.mocked(callGeminiCli).mockRejectedValue(42);
    vi.mocked(callCursorCli).mockRejectedValue({ custom: 'object' });
    vi.mocked(callOpenRouterBackend).mockResolvedValue(makeResponse('fallback'));

    const result = await routeRequest(baseReq);
    expect(result.backend).toBe('openrouter');
  });

  it('handles non-Error throw in gemini-api path', async () => {
    vi.mocked(detectCliTool).mockResolvedValue(false);
    vi.mocked(hasGeminiCredentials).mockReturnValue(true);
    vi.mocked(callGeminiApiBackend).mockRejectedValue('api string error');
    vi.mocked(callOpenRouterBackend).mockResolvedValue(makeResponse('fallback'));

    const result = await routeRequest(baseReq);
    expect(result.backend).toBe('openrouter');
  });

  it('handles non-Error throw in openrouter path', async () => {
    vi.mocked(detectCliTool).mockResolvedValue(false);
    vi.mocked(callOpenRouterBackend).mockRejectedValue('openrouter string error');

    await expect(routeRequest(baseReq)).rejects.toThrow('All routing backends exhausted');
  });

  it('handles non-Error throw in forced backend path', async () => {
    vi.mocked(getForcedBackend).mockReturnValue('claude-cli');
    vi.mocked(callClaudeCli).mockRejectedValue('forced string error');
    vi.mocked(detectCliTool).mockResolvedValue(false);
    vi.mocked(callOpenRouterBackend).mockResolvedValue(makeResponse('auto'));

    const result = await routeRequest(baseReq);
    expect(result.backend).toBe('openrouter');
  });
});

describe('extractText', () => {
  it('returns string content as-is', () => {
    expect(extractText('hello world')).toBe('hello world');
  });

  it('extracts text from ContentBlock array', () => {
    const blocks = [
      { type: 'text' as const, text: 'Hello ' },
      { type: 'tool_use' as const, id: 'tu_1', name: 'test', input: {} },
      { type: 'text' as const, text: 'World' },
    ];
    expect(extractText(blocks)).toBe('Hello World');
  });

  it('returns empty string for array with no text blocks', () => {
    const blocks = [{ type: 'tool_use' as const, id: 'tu_1', name: 'test', input: {} }];
    expect(extractText(blocks)).toBe('');
  });
});
