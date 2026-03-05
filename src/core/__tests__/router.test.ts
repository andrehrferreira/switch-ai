import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Model } from '../../registry/model-registry';
import type { AnthropicResponse } from '../../server/types';

vi.mock('../selection-algorithm');
vi.mock('../backends/openrouter-backend');
vi.mock('../backends/cli-backend');

import { selectModel } from '../selection-algorithm';
import { callOpenRouterBackend } from '../backends/openrouter-backend';
import { detectCliTool, callClaudeCli, callGeminiCli } from '../backends/cli-backend';
import { routeRequest } from '../router';

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
    expect(result.selectedModel).toBe('anthropic/claude-haiku');
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
    expect(result.selectedModel).toBe('google/gemini-flash');
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
    vi.mocked(callGeminiCli).mockRejectedValue(new Error('Gemini CLI failed'));
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

  it('falls back to claude-cli when all model backends fail and CLI is available', async () => {
    vi.mocked(selectModel).mockReturnValue({
      model: makeModel({ id: 'openrouter/some-model', provider: 'openrouter' }),
      fallbackChain: [],
      confidence: 0.5,
      reasoning: 'test',
    });
    vi.mocked(callOpenRouterBackend).mockRejectedValue(new Error('No key'));
    vi.mocked(detectCliTool).mockResolvedValue(true);
    vi.mocked(callClaudeCli).mockResolvedValue(makeResponse('CLI fallback'));

    const result = await routeRequest(baseReq);
    expect(result.backend).toBe('claude-cli');
    expect(result.selectedModel).toBe('claude-cli');
    expect(result.attempts).toBe(2);
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
});
