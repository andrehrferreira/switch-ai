import OpenAI from 'openai';
import { randomUUID } from 'crypto';
import type { AnthropicResponse, ContentBlock } from '../../server/types';
import { quotaManager } from '../quota-manager';
import logger from '../../utils/logger';

export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';
// Keep for test compatibility
export const OPENROUTER_MESSAGES_URL = 'https://openrouter.ai/api/v1/messages';

export interface BackendRequest {
  modelId: string;
  messages: Array<{ role: string; content: string | ContentBlock[] }>;
  maxTokens: number;
  system?: string;
  tools?: unknown[];
  toolChoice?: unknown;
  apiKey?: string;
}

type OpenAIMessage =
  | OpenAI.Chat.ChatCompletionMessageParam
  | OpenAI.Chat.ChatCompletionToolMessageParam;

/** Strip Anthropic-only block types (thinking, etc.) that other providers don't understand */
function stripUnsupportedBlocks(blocks: ContentBlock[]): ContentBlock[] {
  return blocks.filter((b) => ['text', 'tool_use', 'tool_result', 'image'].includes(b.type));
}

/** Convert Anthropic messages to OpenAI chat format */
function toOpenAIMessages(
  messages: Array<{ role: string; content: string | ContentBlock[] }>,
  system?: string
): OpenAIMessage[] {
  const result: OpenAIMessage[] = [];

  if (system) {
    result.push({ role: 'system', content: system });
  }

  for (const m of messages) {
    const blocks = typeof m.content === 'string'
      ? [{ type: 'text' as const, text: m.content }]
      : stripUnsupportedBlocks(m.content as ContentBlock[]);

    if (m.role === 'user') {
      // Split tool_result blocks into separate 'tool' messages
      const toolResults = blocks.filter((b) => b.type === 'tool_result') as Array<{
        type: 'tool_result'; tool_use_id: string; content: string | ContentBlock[];
      }>;
      const others = blocks.filter((b) => b.type !== 'tool_result');

      if (others.length > 0) {
        const text = others
          .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
          .map((b) => b.text)
          .join('');
        if (text.trim()) result.push({ role: 'user', content: text });
      }

      for (const tr of toolResults) {
        const content =
          typeof tr.content === 'string'
            ? tr.content
            : (tr.content as ContentBlock[])
                .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
                .map((b) => b.text)
                .join('');
        result.push({ role: 'tool', tool_call_id: tr.tool_use_id, content });
      }
    } else {
      // assistant
      const textBlocks = blocks
        .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
        .map((b) => b.text)
        .join('');
      const toolUses = blocks.filter((b) => b.type === 'tool_use') as Array<{
        type: 'tool_use'; id: string; name: string; input: unknown;
      }>;

      const msg: OpenAI.Chat.ChatCompletionAssistantMessageParam = { role: 'assistant' };
      if (textBlocks.trim()) msg.content = textBlocks;
      if (toolUses.length > 0) {
        msg.tool_calls = toolUses.map((tu) => ({
          id: tu.id,
          type: 'function' as const,
          function: { name: tu.name, arguments: JSON.stringify(tu.input) },
        }));
      }
      result.push(msg);
    }
  }

  return result;
}

/** Convert Anthropic tool definitions to OpenAI function tools */
function toOpenAITools(tools: unknown[]): OpenAI.Chat.ChatCompletionTool[] {
  return tools.map((t) => {
    const tool = t as { name: string; description?: string; input_schema?: unknown };
    return {
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description ?? '',
        parameters: (tool.input_schema ?? { type: 'object', properties: {} }) as Record<string, unknown>,
      },
    };
  });
}

/** Convert OpenAI response to Anthropic format */
function toAnthropicResponse(
  completion: OpenAI.Chat.ChatCompletion,
  modelId: string
): AnthropicResponse {
  const choice = completion.choices[0];
  const msg = choice?.message;
  const content: ContentBlock[] = [];

  if (msg?.content) {
    content.push({ type: 'text', text: msg.content });
  }

  for (const tc of msg?.tool_calls ?? []) {
    const fn = (tc as { id: string; function?: { name: string; arguments: string } }).function;
    if (!fn) continue;
    let input: unknown = {};
    try { input = JSON.parse(fn.arguments); } catch { /* leave as empty */ }
    content.push({
      type: 'tool_use',
      id: tc.id,
      name: fn.name,
      input,
    });
  }

  const finishReason = choice?.finish_reason;
  // Some models (e.g. Anthropic via OpenRouter) return finish_reason "stop" even when
  // tool_calls are present. Infer from content to avoid sending stop_reason "end_turn"
  // with tool_use blocks, which causes Claude Code to freeze.
  const hasToolCalls = content.some((b) => b.type === 'tool_use');
  const stop_reason =
    hasToolCalls ? 'tool_use'
    : finishReason === 'length' ? 'max_tokens'
    : 'end_turn';

  return {
    id: completion.id || `msg_${randomUUID()}`,
    type: 'message',
    role: 'assistant',
    content,
    model: completion.model || modelId,
    stop_reason,
    stop_sequence: null,
    usage: {
      input_tokens: completion.usage?.prompt_tokens ?? 0,
      output_tokens: completion.usage?.completion_tokens ?? 0,
    },
  };
}

export async function callOpenRouterBackend(req: BackendRequest): Promise<AnthropicResponse> {
  const key = req.apiKey ?? process.env['OPENROUTER_KEY'];

  const client = new OpenAI({
    apiKey: key ?? 'no-key',
    baseURL: OPENROUTER_API_URL,
    defaultHeaders: {
      'HTTP-Referer': 'https://github.com/switch-ai/switch-ai',
    },
  });

  const messages = toOpenAIMessages(req.messages, req.system);
  const tools = req.tools?.length ? toOpenAITools(req.tools) : undefined;

  const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model: req.modelId,
    messages,
    max_tokens: req.maxTokens,
    stream: false,
  };

  if (tools) params.tools = tools;

  if (req.toolChoice && tools) {
    const tc = req.toolChoice as { type?: string; name?: string };
    if (tc.type === 'any') params.tool_choice = 'required';
    else if (tc.type === 'tool' && tc.name) {
      params.tool_choice = { type: 'function', function: { name: tc.name } };
    } else if (tc.type === 'auto') {
      params.tool_choice = 'auto';
    }
  }

  try {
    const completion = await client.chat.completions.create(params, { timeout: 60_000 });
    quotaManager.markAvailable(req.modelId);
    logger.info(`Routed via openrouter (${req.modelId})`);
    return toAnthropicResponse(completion, req.modelId);
  } catch (err) {
    if (err instanceof OpenAI.APIError && err.status === 429) {
      quotaManager.markExhausted(req.modelId);
      logger.warn(`OpenRouter quota exceeded for ${req.modelId}`);
    }
    throw err;
  }
}
