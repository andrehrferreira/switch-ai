import MODELS_DATA from './models.json';
import { readDiskCache } from './openrouter';

export type ModelTier = 'free' | 'cheap' | 'balanced' | 'premium';
export type ModelProvider = 'anthropic' | 'openai' | 'google' | 'openrouter' | 'local';

export interface ModelCost {
  input: number; // per 1k tokens
  output: number; // per 1k tokens
}

export interface Model {
  id: string;
  name: string;
  tier: ModelTier;
  provider: ModelProvider;
  costPer1kTokens: ModelCost;
  contextWindow: number;
  categories: string[];
  enabled: boolean;
  requiresCredits?: boolean;
  requiresQuota?: boolean;
}

class ModelRegistry {
  private models: Model[];

  constructor() {
    // Prefer disk cache (from last OpenRouter sync), fall back to bundled JSON
    this.models = readDiskCache() ?? (MODELS_DATA as Model[]);
  }

  reload(models: Model[]): void {
    this.models = models;
  }

  /**
   * Get all models (optionally filtered by tier)
   */
  getModels(tier?: ModelTier): Model[] {
    if (tier) {
      return this.models.filter((m) => m.tier === tier && m.enabled);
    }
    return this.models.filter((m) => m.enabled);
  }

  /**
   * Get a specific model by ID
   */
  getModel(id: string): Model | undefined {
    return this.models.find((m) => m.id === id);
  }

  /**
   * Get models for a specific category
   */
  getModelsForCategory(category: string): Model[] {
    return this.models.filter(
      (m) => m.enabled && (m.categories.includes(category) || m.categories.includes('all'))
    );
  }

  /**
   * Get models by tier
   */
  getModelsByTier(tier: ModelTier): Model[] {
    return this.models.filter((m) => m.tier === tier && m.enabled);
  }

  /**
   * Get tier for a complexity score
   */
  getTierForScore(score: number): ModelTier {
    if (score <= 3) return 'free';
    if (score <= 5) return 'cheap';
    if (score <= 7) return 'balanced';
    return 'premium';
  }

  /**
   * Get fallback chain for a model (next tier up)
   */
  getFallbackChain(tier: ModelTier): ModelTier[] {
    const chain: Record<ModelTier, ModelTier[]> = {
      free: ['cheap', 'balanced', 'premium'],
      cheap: ['balanced', 'premium'],
      balanced: ['premium'],
      premium: [], // No fallback from premium
    };
    return chain[tier];
  }

  /**
   * Calculate cost for a request
   */
  calculateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const model = this.getModel(modelId);
    if (!model) return 0;

    const inputCost = (inputTokens / 1000) * model.costPer1kTokens.input;
    const outputCost = (outputTokens / 1000) * model.costPer1kTokens.output;
    return inputCost + outputCost;
  }

  /**
   * Get models sorted by cost (cheapest first)
   */
  getModelsByCost(): Model[] {
    return [...this.models].filter((m) => m.enabled).sort((a, b) => {
      const costA = (a.costPer1kTokens.input + a.costPer1kTokens.output) / 2;
      const costB = (b.costPer1kTokens.input + b.costPer1kTokens.output) / 2;
      return costA - costB;
    });
  }
}

export const modelRegistry = new ModelRegistry();
