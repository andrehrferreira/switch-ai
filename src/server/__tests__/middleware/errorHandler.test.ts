import { describe, it, expect } from 'vitest';
import { errorHandlerMiddleware } from '../../middleware/errorHandler';
import { ValidationError, DatabaseError, ConfigError } from '../../../utils/errors';
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

describe('errorHandlerMiddleware', () => {
  it('calls next() when no error', async () => {
    const ctx = makeCtx();
    let nextCalled = false;
    await errorHandlerMiddleware(ctx, async () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it('handles ValidationError and sets parsedBody', async () => {
    const ctx = makeCtx();
    await errorHandlerMiddleware(ctx, async () => {
      throw new ValidationError('Bad input', 'model');
    });
    const body = ctx.parsedBody as { error: { type: string; message: string } };
    expect(body.error.type).toBe('invalid_request_error');
    expect(body.error.message).toContain('Bad input');
  });

  it('handles DatabaseError and sets parsedBody', async () => {
    const ctx = makeCtx();
    await errorHandlerMiddleware(ctx, async () => {
      throw new DatabaseError('DB down');
    });
    const body = ctx.parsedBody as { error: { type: string; message: string } };
    expect(body.error.type).toBe('internal_server_error');
    expect(body.error.message).toBe('Database error');
  });

  it('handles ConfigError and sets parsedBody', async () => {
    const ctx = makeCtx();
    await errorHandlerMiddleware(ctx, async () => {
      throw new ConfigError('Bad config');
    });
    const body = ctx.parsedBody as { error: { type: string; message: string } };
    expect(body.error.type).toBe('internal_server_error');
    expect(body.error.message).toBe('Configuration error');
  });

  it('handles generic Error and sets parsedBody', async () => {
    const ctx = makeCtx();
    await errorHandlerMiddleware(ctx, async () => {
      throw new Error('Unknown');
    });
    const body = ctx.parsedBody as { error: { type: string; message: string } };
    expect(body.error.type).toBe('internal_server_error');
    expect(body.error.message).toBe('Internal server error');
  });

  it('handles non-Error thrown values', async () => {
    const ctx = makeCtx();
    await errorHandlerMiddleware(ctx, async () => {
      throw 'string error';
    });
    const body = ctx.parsedBody as { error: { type: string; message: string } };
    expect(body.error.type).toBe('internal_server_error');
  });

  it('includes error_id in response', async () => {
    const ctx = makeCtx();
    await errorHandlerMiddleware(ctx, async () => {
      throw new ValidationError('Bad');
    });
    const body = ctx.parsedBody as { error: { error_id?: string } };
    expect(body.error.error_id).toBeDefined();
  });
});
