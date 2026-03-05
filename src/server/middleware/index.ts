import type { MiddlewareFn, RequestContext } from '../types';
import { errorHandlerMiddleware } from './errorHandler';
import { loggerMiddleware } from './logger';
import { validateMiddleware } from './validate';

export function createMiddlewareStack(): MiddlewareFn[] {
  return [errorHandlerMiddleware, loggerMiddleware, validateMiddleware];
}

export async function executeMiddlewareStack(
  ctx: RequestContext,
  middlewares: MiddlewareFn[]
): Promise<void> {
  let index = 0;

  const next = async (): Promise<void> => {
    if (index >= middlewares.length) {
      return;
    }
    const middleware = middlewares[index];
    index += 1;
    await middleware(ctx, next);
  };

  await next();
}
