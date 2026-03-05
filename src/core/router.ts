import { selectModel } from './selection-algorithm';
import { callOpenRouterBackend } from './backends/openrouter-backend';
import { detectCliTool, callClaudeCli, callGeminiCli } from './backends/cli-backend';
import type { AnthropicResponse, ContentBlock } from '../server/types';
import logger from '../utils/logger';

export type MessageContent = string | ContentBlock[];

export interface RouterRequest {
  messages: Array<{ role: string; content: MessageContent }>;
  maxTokens: number;
  preferredModel?: string;
  blacklistedModels?: string[];
  system?: string;
  tools?: unknown[];
  toolChoice?: unknown;
}

/** Extract plain text from a message content for analysis purposes */
export function extractText(content: MessageContent): string {
  if (typeof content === 'string') return content;
  return content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

export interface RouterResult {
  response: AnthropicResponse;
  selectedModel: string;
  backend: 'openrouter' | 'claude-cli' | 'gemini-cli';
  attempts: number;
}

export async function routeRequest(req: RouterRequest): Promise<RouterResult> {
  const prompt = req.messages.map((m) => extractText(m.content)).join('\n');
  const selection = selectModel(prompt, {
    blacklistedModels: req.blacklistedModels,
    preferredModels: req.preferredModel ? [req.preferredModel] : undefined,
  });

  let attempts = 0;

  // Priority 1: Claude CLI (free subscription, no cost)
  if (await detectCliTool('claude')) {
    attempts++;
    try {
      const response = await callClaudeCli(req.messages, req.maxTokens);
      logger.info('Routed via claude-cli');
      return { response, selectedModel: 'claude-cli', backend: 'claude-cli', attempts };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`Claude CLI failed: ${msg}`);
    }
  }

  // Priority 2: Gemini CLI (free subscription, no cost)
  if (await detectCliTool('gemini')) {
    attempts++;
    try {
      const response = await callGeminiCli(req.messages, req.maxTokens);
      logger.info('Routed via gemini-cli');
      return { response, selectedModel: 'gemini-cli', backend: 'gemini-cli', attempts };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`Gemini CLI failed: ${msg}`);
    }
  }

  // Priority 3: OpenRouter (paid) — try selected model + fallback chain
  const modelsToTry = [selection.model, ...selection.fallbackChain];
  for (const model of modelsToTry) {
    attempts++;
    try {
      const response = await callOpenRouterBackend({
        modelId: model.id,
        messages: req.messages,
        maxTokens: req.maxTokens,
        system: req.system,
        tools: req.tools,
        toolChoice: req.toolChoice,
      });
      return { response, selectedModel: model.id, backend: 'openrouter', attempts };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`OpenRouter backend failed for ${model.id}: ${msg}`);
    }
  }

  throw new Error('All routing backends exhausted');
}
