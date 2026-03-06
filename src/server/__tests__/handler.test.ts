import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../core/orchestrator');
vi.mock('../middleware', () => ({
  createMiddlewareStack: vi.fn().mockReturnValue([]),
  executeMiddlewareStack: vi.fn().mockResolvedValue(undefined),
}));

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

  it('handles valid request without middleware interference', async () => {
    const ctx = makeCtx();
    const response = await handleRequest(ctx);
    expect(response.type).toBe('message');
  });

  it('throws ValidationError when error type is invalid_request_error', async () => {
    const ctx = makeCtx();
    ctx.parsedBody = {
      error: { type: 'invalid_request_error', message: 'Missing required field' },
    };
    await expect(handleRequest(ctx)).rejects.toThrow('Missing required field');
  });

  it('throws generic Error when error type is not invalid_request_error', async () => {
    const ctx = makeCtx();
    ctx.parsedBody = {
      error: { type: 'server_error', message: 'Internal failure' },
    };
    await expect(handleRequest(ctx)).rejects.toThrow('Internal failure');
  });

  it('throws with default message when error has no message', async () => {
    const ctx = makeCtx();
    ctx.parsedBody = {
      error: { type: 'unknown' },
    };
    await expect(handleRequest(ctx)).rejects.toThrow('Request error');
  });

  it('uses response model when client model is empty', async () => {
    vi.mocked(orchestrate).mockResolvedValue(makeOrchestrateResult('backend-model'));
    const ctx = makeCtx({
      parsedBody: {
        model: '',
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 50,
      },
    });
    const response = await handleRequest(ctx);
    expect(response.model).toBe('backend-model');
  });

  it('passes system, tools, and toolChoice to orchestrate', async () => {
    const ctx = makeCtx({
      parsedBody: {
        model: 'test',
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 100,
        system: 'Be helpful',
        tools: [{ name: 'read' }],
        tool_choice: { type: 'auto' },
      },
    });
    await handleRequest(ctx);
    expect(orchestrate).toHaveBeenCalledWith(
      expect.objectContaining({
        system: 'Be helpful',
        tools: [{ name: 'read' }],
        toolChoice: { type: 'auto' },
      })
    );
  });
});
