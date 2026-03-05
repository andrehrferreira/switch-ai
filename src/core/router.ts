import { selectModel } from './selection-algorithm';
import { callOpenRouterBackend } from './backends/openrouter-backend';
import { detectCliTool, callClaudeCli, callGeminiCli, callCursorCli } from './backends/cli-backend';
import { hasGeminiCredentials, callGeminiApiBackend } from './backends/gemini-api-backend';
import { getForcedBackend } from './backend-preference';
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
  backend: 'openrouter' | 'claude-cli' | 'gemini-cli' | 'cursor-cli' | 'gemini-api';
  attempts: number;
}

export async function routeRequest(req: RouterRequest): Promise<RouterResult> {
  const prompt = req.messages.map((m) => extractText(m.content)).join('\n');
  const selection = selectModel(prompt, {
    blacklistedModels: req.blacklistedModels,
    preferredModels: req.preferredModel ? [req.preferredModel] : undefined,
  });

  let attempts = 0;
  const forced = getForcedBackend();

  const hasToolResult = req.messages.some(
    (m) => Array.isArray(m.content) && (m.content as Array<{ type: string }>).some((b) => b.type === 'tool_result')
  );
  const lastAssistant = [...req.messages].reverse().find((m) => m.role === 'assistant');
  const lastAssistantUsedTool = lastAssistant
    && Array.isArray(lastAssistant.content)
    && (lastAssistant.content as Array<{ type: string }>).some((b) => b.type === 'tool_use');
  const cliEligible = !hasToolResult && !lastAssistantUsedTool;

  logger.debug('Routing decision', {
    forced,
    cliEligible,
    hasToolResult,
    lastAssistantUsedTool: !!lastAssistantUsedTool,
    hasTools: (req.tools?.length ?? 0) > 0,
    messageCount: req.messages.length,
    promptLength: prompt.length,
    preferredModel: req.preferredModel,
    hasGeminiKey: hasGeminiCredentials(),
    hasOpenRouterKey: !!process.env['OPENROUTER_KEY'],
    selectedModel: selection.model.id,
    fallbackChain: selection.fallbackChain.map((m) => m.id),
  });

  // ── Forced backend mode ──
  if (forced !== 'auto') {
    attempts++;
    logger.info(`Forced backend: ${forced}`);
    if (forced === 'claude-cli') {
      const response = await callClaudeCli(req.messages, req.maxTokens);
      return { response, selectedModel: 'claude-cli', backend: 'claude-cli', attempts };
    }
    if (forced === 'gemini-cli') {
      const response = await callGeminiCli(req.messages, req.maxTokens);
      return { response, selectedModel: 'gemini-cli', backend: 'gemini-cli', attempts };
    }
    if (forced === 'cursor-cli') {
      const response = await callCursorCli(req.messages, req.maxTokens);
      return { response, selectedModel: 'cursor-cli', backend: 'cursor-cli', attempts };
    }
    if (forced === 'gemini-api') {
      const response = await callGeminiApiBackend({
        messages: req.messages, maxTokens: req.maxTokens,
        system: req.system, tools: req.tools, toolChoice: req.toolChoice,
      });
      return { response, selectedModel: 'gemini-api', backend: 'gemini-api', attempts };
    }
    if (forced === 'openrouter') {
      const model = selection.model;
      const response = await callOpenRouterBackend({
        modelId: model.id, messages: req.messages, maxTokens: req.maxTokens,
        system: req.system, tools: req.tools, toolChoice: req.toolChoice,
      });
      return { response, selectedModel: model.id, backend: 'openrouter', attempts };
    }
  }

  // ── Auto mode: try free CLIs first, then paid ──
  if (cliEligible) {
    // Priority 1: Claude CLI (free subscription, no cost)
    const claudeAvailable = await detectCliTool('claude');
    logger.debug('Claude CLI detection', { available: claudeAvailable });
    if (claudeAvailable) {
      attempts++;
      try {
        const response = await callClaudeCli(req.messages, req.maxTokens);
        logger.info('Routed via claude-cli');
        return { response, selectedModel: 'claude-cli', backend: 'claude-cli', attempts };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const stderr = (err as { stderr?: string }).stderr ?? '';
        logger.warn(`Claude CLI failed: ${msg}`, { stderr: stderr.slice(0, 500) });
      }
    }

    // Priority 2: Gemini CLI (free subscription, no cost)
    const geminiAvailable = await detectCliTool('gemini');
    logger.debug('Gemini CLI detection', { available: geminiAvailable });
    if (geminiAvailable) {
      attempts++;
      try {
        const response = await callGeminiCli(req.messages, req.maxTokens);
        logger.info('Routed via gemini-cli');
        return { response, selectedModel: 'gemini-cli', backend: 'gemini-cli', attempts };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const stderr = (err as { stderr?: string }).stderr ?? '';
        logger.warn(`Gemini CLI failed: ${msg}`, { stderr: stderr.slice(0, 500) });
      }
    }

    // Priority 3: Cursor CLI (free subscription, no cost)
    const cursorAvailable = await detectCliTool('cursor-agent');
    logger.debug('Cursor CLI detection', { available: cursorAvailable });
    if (cursorAvailable) {
      attempts++;
      try {
        const response = await callCursorCli(req.messages, req.maxTokens);
        logger.info('Routed via cursor-cli');
        return { response, selectedModel: 'cursor-cli', backend: 'cursor-cli', attempts };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const stderr = (err as { stderr?: string }).stderr ?? '';
        logger.warn(`Cursor CLI failed: ${msg}`, { stderr: stderr.slice(0, 500) });
      }
    }
  } else {
    logger.debug('CLIs skipped (mid-tool-flow)');
  }

  // Priority 4: Gemini API (GEMINI_API_KEY) — handles tool calls
  if (hasGeminiCredentials()) {
    attempts++;
    try {
      const response = await callGeminiApiBackend({
        messages: req.messages,
        maxTokens: req.maxTokens,
        system: req.system,
        tools: req.tools,
        toolChoice: req.toolChoice,
      });
      logger.info('Routed via gemini-api');
      return { response, selectedModel: 'gemini-api', backend: 'gemini-api', attempts };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`Gemini API failed: ${msg}`);
    }
  }

  // Priority 5: OpenRouter (paid) — try selected model + fallback chain
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
