import { routeRequest, extractText, type RouterRequest, type RouterResult } from './router';
import { validateResponse } from './validator';
import { analyzeComplexity } from './complexity-analyzer';
import { recordRequest } from '../memory/recorder';
import { recordFailure, getBlacklistedModels } from '../memory/learning';
import { modelRegistry } from '../registry/model-registry';

export async function orchestrate(req: RouterRequest): Promise<RouterResult> {
  const startTime = Date.now();
  const prompt = req.messages.map((m) => extractText(m.content)).join('\n');
  const analysis = analyzeComplexity(prompt);

  // Merge DB blacklist with request blacklist
  const dbBlacklist = getBlacklistedModels();
  const blacklisted = [...(req.blacklistedModels ?? []), ...dbBlacklist];

  // First routing attempt
  const result = await routeRequest({ ...req, blacklistedModels: blacklisted });
  const validation = validateResponse(result.response, prompt.length);

  if (validation.passed) {
    const latencyMs = Date.now() - startTime;
    const { input_tokens, output_tokens } = result.response.usage;
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
    return result;
  }

  // Quality failed — record failure and retry with model blacklisted
  recordFailure(result.selectedModel, analysis.category, 'quality_failure');

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

  return finalResult;
}
