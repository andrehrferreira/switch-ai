import { describe, it, expect } from 'vitest';
import { createMiddlewareStack, executeMiddlewareStack } from '../../middleware';
import type { RequestContext, MiddlewareFn } from '../../types';

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

describe('createMiddlewareStack', () => {
  it('returns an array of 3 middlewares', () => {
    const stack = createMiddlewareStack();
    expect(stack).toHaveLength(3);
  });

  it('each element is a function', () => {
    const stack = createMiddlewareStack();
    for (const mw of stack) {
      expect(typeof mw).toBe('function');
    }
  });
});

describe('executeMiddlewareStack', () => {
  it('executes all middlewares in order', async () => {
    const order: number[] = [];
    const m1: MiddlewareFn = async (ctx, next) => { order.push(1); await next(); };
    const m2: MiddlewareFn = async (ctx, next) => { order.push(2); await next(); };
    const m3: MiddlewareFn = async (ctx, next) => { order.push(3); await next(); };

    const ctx = makeCtx();
    await executeMiddlewareStack(ctx, [m1, m2, m3]);
    expect(order).toEqual([1, 2, 3]);
  });

  it('stops execution if next() is not called', async () => {
    const order: number[] = [];
    const m1: MiddlewareFn = async () => { order.push(1); };
    const m2: MiddlewareFn = async (ctx, next) => { order.push(2); await next(); };

    const ctx = makeCtx();
    await executeMiddlewareStack(ctx, [m1, m2]);
    expect(order).toEqual([1]);
  });

  it('handles empty middleware array', async () => {
    const ctx = makeCtx();
    await expect(executeMiddlewareStack(ctx, [])).resolves.toBeUndefined();
  });

  it('passes ctx to all middlewares', async () => {
    const captured: RequestContext[] = [];
    const m1: MiddlewareFn = async (ctx, next) => { captured.push(ctx); await next(); };
    const m2: MiddlewareFn = async (ctx, next) => { captured.push(ctx); await next(); };

    const ctx = makeCtx();
    await executeMiddlewareStack(ctx, [m1, m2]);
    expect(captured[0]).toBe(ctx);
    expect(captured[1]).toBe(ctx);
  });
});
