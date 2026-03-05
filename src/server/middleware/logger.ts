import logger from '../../utils/logger';
import type { MiddlewareFn } from '../types';

export const loggerMiddleware: MiddlewareFn = async (ctx, next) => {
  const startTime = Date.now();

  logger.info('Incoming request', {
    method: ctx.method,
    url: ctx.url,
  });

  await next();

  const latency = Date.now() - startTime;
  logger.info('Request completed', {
    method: ctx.method,
    url: ctx.url,
    latency_ms: latency,
  });
};
