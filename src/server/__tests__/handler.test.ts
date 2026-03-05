import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../core/orchestrator');

import { orchestrate } from '../../core/orchestrator';
import { handleRequest } from '../handler';
import type { RequestContext, AnthropicResponse } from '../types';
import type { RouterResult } from '../../core/router';

function makeCtx(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    method: 'POST',
    url: '/v1/messages',
    headers: {},
    body: '',
    parsedBody: {
      model: 'claude-haiku',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 100,
    },
    ...overrides,
  };
}

function makeOrchestrateResult(model = 'claude-haiku'): RouterResult {
  return {
    response: {
      id: 'msg_orch_123',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Orchestrated response' }],
      model,
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 5, output_tokens: 15 },
    } as AnthropicResponse,
    selectedModel: model,
    backend: 'openrouter' as const,
    attempts: 1,
  };
}

describe('handleRequest', () => {
  beforeEach(() => {
    vi.mocked(orchestrate).mockResolvedValue(makeOrchestrateResult());
  });

  it('returns an AnthropicResponse for a valid request', async () => {
    const ctx = makeCtx();
    const response = await handleRequest(ctx);

    expect(response).toHaveProperty('id');
    expect(response.type).toBe('message');
    expect(response.role).toBe('assistant');
    expect(response.content).toHaveLength(1);
    expect(response.content[0].type).toBe('text');
    expect(response.stop_reason).toBe('end_turn');
    expect(response.stop_sequence).toBeNull();
    expect(response.usage).toHaveProperty('input_tokens');
    expect(response.usage).toHaveProperty('output_tokens');
    expect(response.timestamp).toBeDefined();
  });

  it('echoes the model name in the response', async () => {
    vi.mocked(orchestrate).mockResolvedValue(makeOrchestrateResult('my-test-model'));
    const ctx = makeCtx({
      parsedBody: {
        model: 'my-test-model',
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 50,
      },
    });
    const response = await handleRequest(ctx);
    expect(response.model).toBe('my-test-model');
  });

  it('response id starts with msg_', async () => {
    const ctx = makeCtx();
    const response = await handleRequest(ctx);
    expect(response.id).toMatch(/^msg_/);
  });

  it('passes messages and max_tokens to orchestrate', async () => {
    const ctx = makeCtx({
      parsedBody: {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Say hi' }],
        max_tokens: 200,
      },
    });
    await handleRequest(ctx);
    expect(orchestrate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: 'Say hi' }],
        maxTokens: 200,
        preferredModel: 'gpt-4',
      })
    );
  });

  it('generates id when orchestrate response has no id', async () => {
    vi.mocked(orchestrate).mockResolvedValue({
      ...makeOrchestrateResult(),
      response: { ...makeOrchestrateResult().response, id: '' },
    });
    const response = await handleRequest(makeCtx());
    expect(response.id).toMatch(/^msg_/);
  });

  it('sets error in parsedBody for invalid endpoint', async () => {
    const ctx = makeCtx({ url: '/v1/invalid' });
    try {
      await handleRequest(ctx);
    } catch {
      // may throw
    }
    expect(ctx.parsedBody).toHaveProperty('error');
  });
});
