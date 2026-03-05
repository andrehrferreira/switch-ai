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

  logger.info('[ROUTER] Incoming request', {
    forced,
    cliEligible,
    hasToolResult,
    lastAssistantUsedTool: !!lastAssistantUsedTool,
    hasTools: (req.tools?.length ?? 0) > 0,
    toolCount: req.tools?.length ?? 0,
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
    logger.info(`[ROUTER] >>> FORCED backend: ${forced}`);
    try {
      if (forced === 'claude-cli') {
        logger.info('[ROUTER] Calling claude-cli (forced)');
        const response = await callClaudeCli(req.messages, req.maxTokens);
        logger.info('[ROUTER] <<< SUCCESS via claude-cli (forced)');
        return { response, selectedModel: 'claude-cli', backend: 'claude-cli', attempts };
      }
      if (forced === 'gemini-cli') {
        logger.info('[ROUTER] Calling gemini-cli (forced)');
        const response = await callGeminiCli(req.messages, req.maxTokens);
        logger.info('[ROUTER] <<< SUCCESS via gemini-cli (forced)');
        return { response, selectedModel: 'gemini-cli', backend: 'gemini-cli', attempts };
      }
      if (forced === 'cursor-cli') {
        logger.info('[ROUTER] Calling cursor-cli (forced)');
        const response = await callCursorCli(req.messages, req.maxTokens);
        logger.info('[ROUTER] <<< SUCCESS via cursor-cli (forced)');
        return { response, selectedModel: 'cursor-cli', backend: 'cursor-cli', attempts };
      }
      if (forced === 'gemini-api') {
        logger.info('[ROUTER] Calling gemini-api (forced)');
        const response = await callGeminiApiBackend({
          messages: req.messages, maxTokens: req.maxTokens,
          system: req.system, tools: req.tools, toolChoice: req.toolChoice,
        });
        logger.info('[ROUTER] <<< SUCCESS via gemini-api (forced)');
        return { response, selectedModel: 'gemini-api', backend: 'gemini-api', attempts };
      }
      if (forced === 'openrouter') {
        const model = selection.model;
        logger.info(`[ROUTER] Calling openrouter/${model.id} (forced)`);
        const response = await callOpenRouterBackend({
          modelId: model.id, messages: req.messages, maxTokens: req.maxTokens,
          system: req.system, tools: req.tools, toolChoice: req.toolChoice,
        });
        logger.info(`[ROUTER] <<< SUCCESS via openrouter/${model.id} (forced)`);
        return { response, selectedModel: model.id, backend: 'openrouter', attempts };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const stderr = (err as { stderr?: string }).stderr ?? '';
      logger.error(`[ROUTER] !!! FORCED backend ${forced} FAILED, falling through to auto`, {
        error: msg,
        stderr: stderr.slice(0, 500),
      });
      // Fall through to auto mode instead of crashing with 500
    }
  }

  // ── Auto mode: try free CLIs first, then paid ──
  logger.info('[ROUTER] Entering auto mode', { cliEligible });
  if (cliEligible) {
    // Priority 1: Claude CLI (free subscription, no cost)
    const claudeAvailable = await detectCliTool('claude');
    logger.info(`[ROUTER] claude-cli available: ${claudeAvailable}`);
    if (claudeAvailable) {
      attempts++;
      try {
        const response = await callClaudeCli(req.messages, req.maxTokens);
        logger.info('[ROUTER] <<< SUCCESS via claude-cli (auto)');
        return { response, selectedModel: 'claude-cli', backend: 'claude-cli', attempts };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const stderr = (err as { stderr?: string }).stderr ?? '';
        logger.warn(`[ROUTER] claude-cli FAILED: ${msg}`, { stderr: stderr.slice(0, 500) });
      }
    }

    // Priority 2: Gemini CLI (free subscription, no cost)
    const geminiAvailable = await detectCliTool('gemini');
    logger.info(`[ROUTER] gemini-cli available: ${geminiAvailable}`);
    if (geminiAvailable) {
      attempts++;
      try {
        const response = await callGeminiCli(req.messages, req.maxTokens);
        logger.info('[ROUTER] <<< SUCCESS via gemini-cli (auto)');
        return { response, selectedModel: 'gemini-cli', backend: 'gemini-cli', attempts };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const stderr = (err as { stderr?: string }).stderr ?? '';
        logger.warn(`[ROUTER] gemini-cli FAILED: ${msg}`, { stderr: stderr.slice(0, 500) });
      }
    }

    // Priority 3: Cursor CLI (free subscription, no cost)
    const cursorAvailable = await detectCliTool('cursor-agent');
    logger.info(`[ROUTER] cursor-cli available: ${cursorAvailable}`);
    if (cursorAvailable) {
      attempts++;
      try {
        const response = await callCursorCli(req.messages, req.maxTokens);
        logger.info('[ROUTER] <<< SUCCESS via cursor-cli (auto)');
        return { response, selectedModel: 'cursor-cli', backend: 'cursor-cli', attempts };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const stderr = (err as { stderr?: string }).stderr ?? '';
        logger.warn(`[ROUTER] cursor-cli FAILED: ${msg}`, { stderr: stderr.slice(0, 500) });
      }
    }
  } else {
    logger.info('[ROUTER] CLIs skipped (mid-tool-flow: hasToolResult=' + hasToolResult + ', lastAssistantUsedTool=' + !!lastAssistantUsedTool + ')');
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
