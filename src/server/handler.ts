import { randomUUID } from 'crypto';
import type { RequestContext, AnthropicRequest, AnthropicResponse } from './types';
import { createMiddlewareStack, executeMiddlewareStack } from './middleware';
import { orchestrate } from '../core/orchestrator';
import { ValidationError } from '../utils/errors';

export async function handleRequest(ctx: RequestContext): Promise<AnthropicResponse> {
  const middlewares = createMiddlewareStack();
  await executeMiddlewareStack(ctx, middlewares);

  // errorHandlerMiddleware may have swallowed an error into parsedBody
  if ((ctx.parsedBody as { error?: unknown }).error) {
    const errData = (ctx.parsedBody as { error: { type?: string; message?: string } }).error;
    const msg = String(errData.message ?? 'Request error');
    if (errData.type === 'invalid_request_error') {
      throw new ValidationError(msg);
    }
    throw new Error(msg);
  }

  const request = ctx.parsedBody as AnthropicRequest;

  const result = await orchestrate({
    messages: request.messages,
    maxTokens: request.max_tokens,
    preferredModel: request.model,
    system: request.system,
    tools: request.tools,
    toolChoice: request.tool_choice,
  });

  return {
    ...result.response,
    id: result.response.id || `msg_${randomUUID()}`,
    // Echo back the model the client requested so Claude Code recognises the response
    model: request.model || result.response.model,
    timestamp: new Date().toISOString(),
  };
}
