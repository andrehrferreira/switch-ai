import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AnthropicResponse } from '../../server/types';
import type { RouterResult } from '../router';

vi.mock('../router');
vi.mock('../validator');
vi.mock('../../memory/recorder');
vi.mock('../../memory/learning');

import { routeRequest } from '../router';
import { validateResponse } from '../validator';
import { recordRequest } from '../../memory/recorder';
import { recordFailure, getBlacklistedModels } from '../../memory/learning';
import { orchestrate } from '../orchestrator';

function makeResponse(text = 'Good answer'): AnthropicResponse {
  return {
    id: 'msg_orch',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text }],
    model: 'test/model',
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 20 },
  };
}

function makeRouterResult(model = 'test/model', attempts = 1): RouterResult {
  return {
    response: makeResponse(),
    selectedModel: model,
    backend: 'openrouter',
    attempts,
  };
}

const baseReq = {
  messages: [{ role: 'user', content: 'Write a sort function' }],
  maxTokens: 500,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getBlacklistedModels).mockReturnValue([]);
  vi.mocked(routeRequest).mockResolvedValue(makeRouterResult());
  vi.mocked(validateResponse).mockReturnValue({ passed: true, score: 1.0, issues: [] });
  vi.mocked(recordRequest).mockReturnValue('req_id_123');
  vi.mocked(recordFailure).mockReturnValue(undefined);
});

describe('orchestrate', () => {
  it('returns RouterResult on successful first attempt', async () => {
    const result = await orchestrate(baseReq);
    expect(result.selectedModel).toBe('test/model');
    expect(result.backend).toBe('openrouter');
  });

  it('records successful request to DB', async () => {
    await orchestrate(baseReq);
    expect(recordRequest).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', validationPassed: true })
    );
  });

  it('merges DB blacklist with request blacklist', async () => {
    vi.mocked(getBlacklistedModels).mockReturnValue(['banned/model']);
    await orchestrate({ ...baseReq, blacklistedModels: ['user/blacklisted'] });
    expect(routeRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        blacklistedModels: expect.arrayContaining(['banned/model', 'user/blacklisted']),
      })
    );
  });

  it('uses preferredModel in recorded initialModel', async () => {
    await orchestrate({ ...baseReq, preferredModel: 'openai/gpt-4' });
    expect(recordRequest).toHaveBeenCalledWith(
      expect.objectContaining({ initialModel: 'openai/gpt-4' })
    );
  });

  it('uses selectedModel as initialModel when no preferredModel', async () => {
    await orchestrate(baseReq);
    expect(recordRequest).toHaveBeenCalledWith(
      expect.objectContaining({ initialModel: 'test/model' })
    );
  });

  it('does not call recordFailure when quality passes', async () => {
    await orchestrate(baseReq);
    expect(recordFailure).not.toHaveBeenCalled();
  });

  it('records failure and retries when quality fails on first attempt', async () => {
    vi.mocked(validateResponse)
      .mockReturnValueOnce({ passed: false, score: 0.5, issues: ['too_short'] })
      .mockReturnValueOnce({ passed: true, score: 1.0, issues: [] });

    vi.mocked(routeRequest)
      .mockResolvedValueOnce(makeRouterResult('bad/model'))
      .mockResolvedValueOnce(makeRouterResult('good/model'));

    const result = await orchestrate(baseReq);
    expect(recordFailure).toHaveBeenCalledWith('bad/model', expect.any(String), 'quality_failure');
    expect(result.selectedModel).toBe('good/model');
  });

  it('blacklists failed model for retry', async () => {
    vi.mocked(validateResponse).mockReturnValue({ passed: false, score: 0.0, issues: ['empty'] });
    vi.mocked(routeRequest)
      .mockResolvedValueOnce(makeRouterResult('bad/model'))
      .mockResolvedValueOnce(makeRouterResult('retry/model'));

    await orchestrate(baseReq);
    expect(routeRequest).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        blacklistedModels: expect.arrayContaining(['bad/model']),
      })
    );
  });

  it('records failure status when retry quality also fails', async () => {
    vi.mocked(validateResponse).mockReturnValue({ passed: false, score: 0.0, issues: ['empty'] });
    vi.mocked(routeRequest)
      .mockResolvedValueOnce(makeRouterResult('first/model'))
      .mockResolvedValueOnce(makeRouterResult('second/model'));

    await orchestrate(baseReq);
    expect(recordRequest).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failure', validationPassed: false })
    );
  });

  it('falls back to original result when retry throws', async () => {
    vi.mocked(validateResponse).mockReturnValue({ passed: false, score: 0.0, issues: ['empty'] });
    vi.mocked(routeRequest)
      .mockResolvedValueOnce(makeRouterResult('first/model'))
      .mockRejectedValueOnce(new Error('All backends failed'));

    const result = await orchestrate(baseReq);
    expect(result.selectedModel).toBe('first/model');
    expect(recordRequest).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failure', validationPassed: false })
    );
  });

  it('records escalations as attempts-1 on successful first attempt', async () => {
    vi.mocked(routeRequest).mockResolvedValue(makeRouterResult('test/model', 3));
    await orchestrate(baseReq);
    expect(recordRequest).toHaveBeenCalledWith(
      expect.objectContaining({ escalations: 2 })
    );
  });

  it('records retried result token usage', async () => {
    vi.mocked(validateResponse)
      .mockReturnValueOnce({ passed: false, score: 0.0, issues: ['empty'] })
      .mockReturnValueOnce({ passed: true, score: 1.0, issues: [] });

    const retriedResult = makeRouterResult('retry/model', 2);
    retriedResult.response.usage = { input_tokens: 15, output_tokens: 30 };
    vi.mocked(routeRequest)
      .mockResolvedValueOnce(makeRouterResult('first/model'))
      .mockResolvedValueOnce(retriedResult);

    await orchestrate(baseReq);
    expect(recordRequest).toHaveBeenCalledWith(
      expect.objectContaining({ tokensInput: 15, tokensOutput: 30 })
    );
  });

  it('propagates routeRequest error on first attempt', async () => {
    vi.mocked(routeRequest).mockRejectedValue(new Error('Router failed'));
    await expect(orchestrate(baseReq)).rejects.toThrow('Router failed');
  });

  it('truncates prompt to 500 chars when recording', async () => {
    const longPrompt = 'x'.repeat(1000);
    await orchestrate({
      messages: [{ role: 'user', content: longPrompt }],
      maxTokens: 100,
    });
    expect(recordRequest).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'x'.repeat(500) })
    );
  });
});
