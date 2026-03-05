import axios from 'axios';
import { randomUUID } from 'crypto';
import type { AnthropicResponse, ContentBlock } from '../../server/types';
import { quotaManager } from '../quota-manager';
import logger from '../../utils/logger';

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

export async function callOpenRouterBackend(req: BackendRequest): Promise<AnthropicResponse> {
  const key = req.apiKey ?? process.env['OPENROUTER_KEY'];
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://github.com/switch-ai/switch-ai',
    'anthropic-version': '2023-06-01',
  };

  if (key) {
    headers['Authorization'] = `Bearer ${key}`;
  }

  const body: Record<string, unknown> = {
    model: req.modelId,
    messages: req.messages,
    max_tokens: req.maxTokens,
  };

  if (req.system) body['system'] = req.system;
  if (req.tools?.length) body['tools'] = req.tools;
  if (req.toolChoice) body['tool_choice'] = req.toolChoice;

  try {
    const resp = await axios.post(OPENROUTER_MESSAGES_URL, body, { headers, timeout: 60_000 });
    quotaManager.markAvailable(req.modelId);
    const data = resp.data as AnthropicResponse;

    return {
      id: data.id || `msg_${randomUUID()}`,
      type: data.type || 'message',
      role: data.role || 'assistant',
      content: data.content ?? [],
      model: data.model || req.modelId,
      stop_reason: data.stop_reason ?? 'end_turn',
      stop_sequence: data.stop_sequence ?? null,
      usage: {
        input_tokens: data.usage?.input_tokens ?? 0,
        output_tokens: data.usage?.output_tokens ?? 0,
      },
    };
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 429) {
      const retryAfter = err.response.headers['retry-after'];
      const retrySeconds = retryAfter ? (parseInt(retryAfter, 10) || undefined) : undefined;
      quotaManager.markExhausted(req.modelId, retrySeconds);
      logger.warn(`OpenRouter quota exceeded for ${req.modelId}. Status: 429`);
    }
    throw err;
  }
}
