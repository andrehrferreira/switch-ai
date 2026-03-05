import axios from 'axios';
import { randomUUID } from 'crypto';
import type { AnthropicResponse, ContentBlock } from '../../server/types';
import { quotaManager } from '../quota-manager';
import logger from '../../utils/logger';

const GEMINI_MODEL = 'gemini-2.0-flash-001';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_API_TIMEOUT_MS = 60_000;

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: { content: unknown } };
  inlineData?: { mimeType: string; data: string };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiTool {
  functionDeclarations: Array<{
    name: string;
    description?: string;
    parameters?: unknown;
  }>;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[]; role?: string };
    finishReason?: string;
  }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

export function hasGeminiCredentials(): boolean {
  return !!(process.env['GEMINI_API_KEY'] ?? process.env['GOOGLE_API_KEY']);
}

/** Build a map of tool_use_id → tool name from all messages */
function buildToolNameMap(messages: Array<{ role: string; content: string | ContentBlock[] }>): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of messages) {
    if (!Array.isArray(m.content)) continue;
    for (const block of m.content as ContentBlock[]) {
      if (block.type === 'tool_use') {
        const tu = block as { type: 'tool_use'; id: string; name: string; input: unknown };
        map.set(tu.id, tu.name);
      }
    }
  }
  return map;
}

function convertMessages(
  messages: Array<{ role: string; content: string | ContentBlock[] }>,
  toolNameMap: Map<string, string>
): GeminiContent[] {
  const contents: GeminiContent[] = [];

  for (const m of messages) {
    const role: 'user' | 'model' = m.role === 'assistant' ? 'model' : 'user';
    const parts: GeminiPart[] = [];

    if (typeof m.content === 'string') {
      if (m.content.trim()) parts.push({ text: m.content });
    } else {
      for (const block of m.content as ContentBlock[]) {
        if (block.type === 'text') {
          const tb = block as { type: 'text'; text: string };
          if (tb.text.trim()) parts.push({ text: tb.text });
        } else if (block.type === 'tool_use') {
          const tu = block as { type: 'tool_use'; id: string; name: string; input: unknown };
          parts.push({
            functionCall: {
              name: tu.name,
              args: (tu.input ?? {}) as Record<string, unknown>,
            },
          });
        } else if (block.type === 'tool_result') {
          const tr = block as { type: 'tool_result'; tool_use_id: string; content: string | ContentBlock[] };
          const toolName = toolNameMap.get(tr.tool_use_id) ?? 'unknown_tool';
          const resultText =
            typeof tr.content === 'string'
              ? tr.content
              : Array.isArray(tr.content)
                ? (tr.content as ContentBlock[])
                    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
                    .map((b) => b.text)
                    .join('')
                : '';
          parts.push({
            functionResponse: {
              name: toolName,
              response: { content: resultText },
            },
          });
        }
      }
    }

    if (parts.length === 0) parts.push({ text: '' });
    contents.push({ role, parts });
  }

  return contents;
}

function convertTools(anthropicTools: unknown[]): GeminiTool[] {
  const declarations = anthropicTools.map((t) => {
    const tool = t as { name: string; description?: string; input_schema?: unknown };
    return {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    };
  });
  return declarations.length > 0 ? [{ functionDeclarations: declarations }] : [];
}

function convertResponse(data: GeminiResponse, model: string): AnthropicResponse {
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const content: ContentBlock[] = [];

  for (const part of parts) {
    if (part.text !== undefined && part.text !== '') {
      content.push({ type: 'text', text: part.text });
    } else if (part.functionCall) {
      content.push({
        type: 'tool_use',
        id: `toolu_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
        name: part.functionCall.name,
        input: part.functionCall.args ?? {},
      });
    }
  }

  const finishReason = candidate?.finishReason ?? 'STOP';
  const stop_reason =
    finishReason === 'MAX_TOKENS'
      ? 'max_tokens'
      : content.some((b) => b.type === 'tool_use')
        ? 'tool_use'
        : 'end_turn';

  return {
    id: `msg_${randomUUID()}`,
    type: 'message',
    role: 'assistant',
    content,
    model,
    stop_reason,
    stop_sequence: null,
    usage: {
      input_tokens: data.usageMetadata?.promptTokenCount ?? 0,
      output_tokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    },
  };
}

export interface GeminiApiRequest {
  messages: Array<{ role: string; content: string | ContentBlock[] }>;
  maxTokens: number;
  system?: string;
  tools?: unknown[];
  toolChoice?: unknown;
}

export async function callGeminiApiBackend(req: GeminiApiRequest): Promise<AnthropicResponse> {
  const modelId = `gemini-api:${GEMINI_MODEL}`;
  const apiKey = process.env['GEMINI_API_KEY'] ?? process.env['GOOGLE_API_KEY'];

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set');
  }

  const toolNameMap = buildToolNameMap(req.messages);
  const contents = convertMessages(req.messages, toolNameMap);
  const tools = req.tools?.length ? convertTools(req.tools) : undefined;

  const body: Record<string, unknown> = {
    contents,
    generationConfig: { maxOutputTokens: req.maxTokens },
  };

  if (req.system) {
    body['systemInstruction'] = { parts: [{ text: req.system }] };
  }

  if (tools) {
    body['tools'] = tools;
  }

  const url = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  try {
    const resp = await axios.post(url, body, { headers, timeout: GEMINI_API_TIMEOUT_MS });
    quotaManager.markAvailable(modelId);
    const data = resp.data as GeminiResponse;
    logger.info(`Routed via gemini-api (${GEMINI_MODEL})`);
    return convertResponse(data, `gemini-api:${GEMINI_MODEL}`);
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 429) {
      quotaManager.markExhausted(modelId, 60);
      logger.warn(`Gemini API quota exceeded`);
    }
    throw err;
  }
}
