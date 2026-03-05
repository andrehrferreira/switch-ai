import { randomUUID } from 'crypto';
import type { RequestContext, AnthropicRequest, AnthropicResponse } from './types';
import { createMiddlewareStack, executeMiddlewareStack } from './middleware';
import { orchestrate } from '../core/orchestrator';

export async function handleRequest(ctx: RequestContext): Promise<AnthropicResponse> {
  const middlewares = createMiddlewareStack();
  await executeMiddlewareStack(ctx, middlewares);

  // errorHandlerMiddleware may have swallowed an error into parsedBody
  if ((ctx.parsedBody as { error?: unknown }).error) {
    throw new Error(
      String((ctx.parsedBody as { error: { message?: string } }).error?.message ?? 'Request error')
    );
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
    timestamp: new Date().toISOString(),
  };
}
