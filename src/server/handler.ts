import { randomUUID } from 'crypto';
import type { RequestContext, AnthropicRequest, AnthropicResponse } from './types';
import { createMiddlewareStack, executeMiddlewareStack } from './middleware';
import { orchestrate } from '../core/orchestrator';
import { ValidationError } from '../utils/errors';
import logger from '../utils/logger';

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

  logger.info('[HANDLER] Processing request', {
    clientModel: request.model,
    messageCount: request.messages.length,
    hasSystem: !!request.system,
    hasTools: !!(request.tools?.length),
    toolCount: request.tools?.length ?? 0,
  });

  const result = await orchestrate({
    messages: request.messages,
    maxTokens: request.max_tokens,
    preferredModel: request.model,
    system: request.system,
    tools: request.tools,
    toolChoice: request.tool_choice,
  });

  logger.info('[HANDLER] Response ready', {
    backend: result.backend,
    selectedModel: result.selectedModel,
    attempts: result.attempts,
    responseModel: result.response.model,
    echoModel: request.model || result.response.model,
  });

  return {
    ...result.response,
    id: result.response.id || `msg_${randomUUID()}`,
    // Echo back the model the client requested so Claude Code recognises the response
    model: request.model || result.response.model,
    timestamp: new Date().toISOString(),
  };
}
