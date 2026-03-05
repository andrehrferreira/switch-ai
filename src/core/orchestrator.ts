import { routeRequest, extractText, type RouterRequest, type RouterResult } from './router';
import { validateResponse } from './validator';
import { analyzeComplexity } from './complexity-analyzer';
import { recordRequest } from '../memory/recorder';
import { recordFailure, getBlacklistedModels } from '../memory/learning';
import { modelRegistry } from '../registry/model-registry';
import logger from '../utils/logger';

export async function orchestrate(req: RouterRequest): Promise<RouterResult> {
  const startTime = Date.now();
  const prompt = req.messages.map((m) => extractText(m.content)).join('\n');
  const analysis = analyzeComplexity(prompt);

  // Merge DB blacklist with request blacklist
  let dbBlacklist: string[] = [];
  try { dbBlacklist = getBlacklistedModels(); } catch { /* DB unavailable */ }
  const blacklisted = [...(req.blacklistedModels ?? []), ...dbBlacklist];

  // First routing attempt
  const result = await routeRequest({ ...req, blacklistedModels: blacklisted });

  // Skip validation for CLI backends — they're free and retrying doubles latency,
  // which causes Claude Code to timeout before the response arrives.
  const isCliFree = result.backend === 'claude-cli' || result.backend === 'gemini-cli' || result.backend === 'cursor-cli';
  const validation = isCliFree ? { passed: true, score: 1, issues: [] } : validateResponse(result.response, prompt.length);

  if (validation.passed) {
    const latencyMs = Date.now() - startTime;
    const { input_tokens, output_tokens } = result.response.usage;
    try {
      recordRequest({
        prompt: prompt.slice(0, 500),
        initialModel: req.preferredModel ?? result.selectedModel,
        finalModel: result.selectedModel,
        category: analysis.category,
        complexityScore: analysis.score,
        status: 'success',
        latencyMs,
        tokensInput: input_tokens,
        tokensOutput: output_tokens,
        cost: modelRegistry.calculateCost(result.selectedModel, input_tokens, output_tokens),
        validationPassed: true,
        escalations: result.attempts - 1,
      });
    } catch (err) {
      logger.warn('Failed to record request', { error: err instanceof Error ? err.message : String(err) });
    }
    return result;
  }

  // Quality failed — record failure and retry with model blacklisted
  try { recordFailure(result.selectedModel, analysis.category, 'quality_failure'); } catch { /* DB unavailable */ }

  const retried = await routeRequest({
    ...req,
    blacklistedModels: [...blacklisted, result.selectedModel],
  }).catch(() => null);

  let finalResult = retried ?? result;
  let validationPassed = false;

  if (retried) {
    const v2 = validateResponse(retried.response, prompt.length);
    validationPassed = v2.passed;
  }

  const latencyMs = Date.now() - startTime;
  const { input_tokens, output_tokens } = finalResult.response.usage;
  try {
    recordRequest({
      prompt: prompt.slice(0, 500),
      initialModel: req.preferredModel ?? result.selectedModel,
      finalModel: finalResult.selectedModel,
      category: analysis.category,
      complexityScore: analysis.score,
      status: validationPassed ? 'success' : 'failure',
      latencyMs,
      tokensInput: input_tokens,
      tokensOutput: output_tokens,
      cost: modelRegistry.calculateCost(finalResult.selectedModel, input_tokens, output_tokens),
      validationPassed,
      escalations: finalResult.attempts,
    });
  } catch (err) {
    logger.warn('Failed to record request', { error: err instanceof Error ? err.message : String(err) });
  }

  return finalResult;
}
