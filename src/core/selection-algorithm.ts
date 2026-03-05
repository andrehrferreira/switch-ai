import { analyzeComplexity } from './complexity-analyzer';
import { modelRegistry, type Model } from '../registry/model-registry';
import { quotaManager } from './quota-manager';

export interface SelectionResult {
  model: Model;
  confidence: number;
  reasoning: string;
  fallbackChain: Model[];
}

export interface SelectionContext {
  complexity: number;
  category: string;
  maxCostPerRequest?: number;
  preferredModels?: string[];
  blacklistedModels?: string[];
  availableModels?: string[];
}

/**
 * 7-step selection algorithm:
 * 1. Filter by availability, tier match & quota
 * 2. Filter by cost constraint
 * 3. Apply user preferences
 * 4. Filter out known failures
 * 5. If no candidates: relax constraints
 * 6. Final ranking
 * 7. Select top candidate
 */
export function selectModel(
  prompt: string,
  context: Partial<SelectionContext> = {}
): SelectionResult {
  // Step 1: Analyze complexity
  const analysis = analyzeComplexity(prompt);
  const complexity = context.complexity ?? analysis.score;
  const category = context.category ?? analysis.category;

  // Step 2: Get target tier
  const targetTier = modelRegistry.getTierForScore(complexity);

  // Step 3: Filter by availability, tier match & quota
  let candidates = modelRegistry.getModels().filter((m) => {
    const tierMatch =
      m.tier === targetTier ||
      m.tier === 'premium' || // Premium matches all complexity levels
      (targetTier === 'free' && (m.tier === 'free' || m.tier === 'cheap')); // Free tier can escalate to cheap

    const isBlacklisted = context.blacklistedModels?.includes(m.id) ?? false;
    const isExhausted = quotaManager.isExhausted(m.id);

    return tierMatch && !isBlacklisted && !isExhausted;
  });

  // Step 4: Filter by cost constraint
  if (context.maxCostPerRequest !== undefined) {
    const maxCost = context.maxCostPerRequest;
    candidates = candidates.filter((m) => {
      // Estimate cost for typical 100 token input/100 token output request
      const estimatedCost = modelRegistry.calculateCost(m.id, 100, 100);
      return estimatedCost <= maxCost;
    });
  }

  // Step 5: Apply user preferences
  if (context.preferredModels && context.preferredModels.length > 0) {
    const preferred = candidates.filter((m) => context.preferredModels?.includes(m.id));
    if (preferred.length > 0) {
      candidates = preferred;
    }
  }

  // Step 6: If no candidates remain, relax constraints
  if (candidates.length === 0) {
    candidates = modelRegistry
      .getModels()
      .filter((m) => !context.blacklistedModels?.includes(m.id));

    if (candidates.length === 0) {
      // Fallback: use cheapest model
      candidates = [modelRegistry.getModelsByCost()[0]];
    }
  }

  // Step 7: Filter for category match (prefer models that excel at this category)
  const categoryMatched = candidates.filter((m) =>
    m.categories.includes(category) || m.categories.includes('all')
  );

  const finalCandidates = categoryMatched.length > 0 ? categoryMatched : candidates;

  // Step 8: Rank by cost (prefer cheaper)
  finalCandidates.sort((a, b) => {
    const costA = (a.costPer1kTokens.input + a.costPer1kTokens.output) / 2;
    const costB = (b.costPer1kTokens.input + b.costPer1kTokens.output) / 2;
    return costA - costB;
  });

  // Step 9: Select top candidate
  const selected = finalCandidates[0];
  const confidence = Math.min(0.95, analysis.confidence * 0.9 + 0.05);

  // Step 10: Build fallback chain
  const fallbackTiers = modelRegistry.getFallbackChain(selected.tier);
  const fallbackChain: Model[] = [];
  for (const tier of fallbackTiers) {
    const tierModels = modelRegistry.getModelsByTier(tier);
    if (tierModels.length > 0) {
      fallbackChain.push(tierModels[0]);
    }
  }

  return {
    model: selected,
    confidence: Math.round(confidence * 100) / 100,
    reasoning: `Selected ${selected.name} (${selected.tier} tier) for ${category} task (complexity: ${complexity}/10)`,
    fallbackChain,
  };
}
