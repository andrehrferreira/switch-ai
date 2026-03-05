import { z } from 'zod';
import { ValidationError } from '../../utils/errors';
import type { MiddlewareFn } from '../types';

const ContentSchema = z.union([
  z.string(),
  z.array(z.object({ type: z.string() }).passthrough()),
]);

const AnthropicRequestSchema = z
  .object({
    model: z.string().min(1),
    messages: z.array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: ContentSchema,
      })
    ),
    max_tokens: z.number().int().positive(),
  })
  .passthrough();

export const validateMiddleware: MiddlewareFn = async (ctx, next) => {
  if (ctx.url.split('?')[0] !== '/v1/messages' || ctx.method !== 'POST') {
    throw new ValidationError(
      'Invalid endpoint. Only POST /v1/messages is supported',
      'endpoint'
    );
  }

  const result = AnthropicRequestSchema.safeParse(ctx.parsedBody);
  if (!result.success) {
    const fieldErrors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
    throw new ValidationError(`Invalid request format: ${fieldErrors.join('; ')}`);
  }

  await next();
};
