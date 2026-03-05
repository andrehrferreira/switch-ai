import { describe, it, expect } from 'vitest';
import { validateMiddleware } from '../../middleware/validate';
import { ValidationError } from '../../../utils/errors';
import type { RequestContext } from '../../types';

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

describe('validateMiddleware', () => {
  it('calls next() for valid POST /v1/messages', async () => {
    const ctx = makeCtx();
    let nextCalled = false;
    await validateMiddleware(ctx, async () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it('throws ValidationError for wrong URL', async () => {
    const ctx = makeCtx({ url: '/v1/other' });
    await expect(validateMiddleware(ctx, async () => {})).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for GET method', async () => {
    const ctx = makeCtx({ method: 'GET' });
    await expect(validateMiddleware(ctx, async () => {})).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for missing model', async () => {
    const ctx = makeCtx({
      parsedBody: { messages: [{ role: 'user', content: 'Hello' }], max_tokens: 100 },
    });
    await expect(validateMiddleware(ctx, async () => {})).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for missing messages', async () => {
    const ctx = makeCtx({
      parsedBody: { model: 'claude-haiku', max_tokens: 100 },
    });
    await expect(validateMiddleware(ctx, async () => {})).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for invalid role', async () => {
    const ctx = makeCtx({
      parsedBody: {
        model: 'claude-haiku',
        messages: [{ role: 'system', content: 'Hello' }],
        max_tokens: 100,
      },
    });
    await expect(validateMiddleware(ctx, async () => {})).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for non-positive max_tokens', async () => {
    const ctx = makeCtx({
      parsedBody: {
        model: 'claude-haiku',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 0,
      },
    });
    await expect(validateMiddleware(ctx, async () => {})).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for empty model string', async () => {
    const ctx = makeCtx({
      parsedBody: {
        model: '',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100,
      },
    });
    await expect(validateMiddleware(ctx, async () => {})).rejects.toThrow(ValidationError);
  });
});
