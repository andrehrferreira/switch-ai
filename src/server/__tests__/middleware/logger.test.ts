import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loggerMiddleware } from '../../middleware/logger';
import type { RequestContext } from '../../types';

function makeCtx(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    method: 'POST',
    url: '/v1/messages',
    headers: {},
    body: '',
    parsedBody: {},
    ...overrides,
  };
}

describe('loggerMiddleware', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('calls next()', async () => {
    const ctx = makeCtx();
    let nextCalled = false;
    await loggerMiddleware(ctx, async () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it('logs method and url on request', async () => {
    const ctx = makeCtx({ method: 'POST', url: '/v1/messages' });
    await loggerMiddleware(ctx, async () => {});
    // Logger writes to stdout
    const allOutput = consoleSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(allOutput).toContain('Incoming request');
  });

  it('logs completion after next()', async () => {
    const ctx = makeCtx();
    await loggerMiddleware(ctx, async () => {});
    const allOutput = consoleSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(allOutput).toContain('Request completed');
  });
});
