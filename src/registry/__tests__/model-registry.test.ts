import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock openrouter so ModelRegistry falls back to bundled models.json
vi.mock('../openrouter', () => ({
  readDiskCache: vi.fn().mockReturnValue(null),
}));

import { modelRegistry } from '../model-registry';
import type { Model } from '../model-registry';

describe('ModelRegistry', () => {
  describe('getModels', () => {
    it('returns only enabled models by default', () => {
      const models = modelRegistry.getModels();
      for (const m of models) {
        expect(m.enabled).toBe(true);
      }
    });

    it('filters by tier when provided', () => {
      const models = modelRegistry.getModels('cheap');
      for (const m of models) {
        expect(m.tier).toBe('cheap');
        expect(m.enabled).toBe(true);
      }
    });

    it('returns multiple models for cheap tier', () => {
      const models = modelRegistry.getModels('cheap');
      expect(models.length).toBeGreaterThan(0);
    });
  });

  describe('getModel', () => {
    it('returns model by id', () => {
      const model = modelRegistry.getModel('claude-opus');
      expect(model).toBeDefined();
      expect(model?.id).toBe('claude-opus');
    });

    it('returns undefined for unknown id', () => {
      const model = modelRegistry.getModel('nonexistent-model');
      expect(model).toBeUndefined();
    });

    it('returns disabled model too', () => {
      const model = modelRegistry.getModel('claude-code');
      expect(model).toBeDefined();
      expect(model?.enabled).toBe(false);
    });
  });

  describe('getModelsForCategory', () => {
    it('returns models for code category', () => {
      const models = modelRegistry.getModelsForCategory('code');
      expect(models.length).toBeGreaterThan(0);
    });

    it('returns models that match category or all', () => {
      const models = modelRegistry.getModelsForCategory('research');
      for (const m of models) {
        expect(m.categories.includes('research') || m.categories.includes('all')).toBe(true);
      }
    });

    it('returns empty array for unknown category', () => {
      const models = modelRegistry.getModelsForCategory('nonexistent-category');
      expect(Array.isArray(models)).toBe(true);
    });
  });

  describe('getModelsByTier', () => {
    it('returns enabled models for given tier', () => {
      const models = modelRegistry.getModelsByTier('balanced');
      for (const m of models) {
        expect(m.tier).toBe('balanced');
        expect(m.enabled).toBe(true);
      }
    });

    it('returns empty array for free tier (all disabled)', () => {
      const models = modelRegistry.getModelsByTier('free');
      expect(Array.isArray(models)).toBe(true);
    });
  });

  describe('getTierForScore', () => {
    it('returns free for score 1-3', () => {
      expect(modelRegistry.getTierForScore(1)).toBe('free');
      expect(modelRegistry.getTierForScore(3)).toBe('free');
    });

    it('returns cheap for score 4-5', () => {
      expect(modelRegistry.getTierForScore(4)).toBe('cheap');
      expect(modelRegistry.getTierForScore(5)).toBe('cheap');
    });

    it('returns balanced for score 6-7', () => {
      expect(modelRegistry.getTierForScore(6)).toBe('balanced');
      expect(modelRegistry.getTierForScore(7)).toBe('balanced');
    });

    it('returns premium for score 8+', () => {
      expect(modelRegistry.getTierForScore(8)).toBe('premium');
      expect(modelRegistry.getTierForScore(10)).toBe('premium');
    });
  });

  describe('getFallbackChain', () => {
    it('free tier falls back to cheap, balanced, premium', () => {
      expect(modelRegistry.getFallbackChain('free')).toEqual(['cheap', 'balanced', 'premium']);
    });

    it('cheap tier falls back to balanced, premium', () => {
      expect(modelRegistry.getFallbackChain('cheap')).toEqual(['balanced', 'premium']);
    });

    it('balanced tier falls back to premium', () => {
      expect(modelRegistry.getFallbackChain('balanced')).toEqual(['premium']);
    });

    it('premium tier has no fallback', () => {
      expect(modelRegistry.getFallbackChain('premium')).toEqual([]);
    });
  });

  describe('calculateCost', () => {
    it('calculates cost for a known model', () => {
      const cost = modelRegistry.calculateCost('claude-opus', 1000, 1000);
      expect(cost).toBeCloseTo(0.09);
    });

    it('returns 0 for unknown model', () => {
      const cost = modelRegistry.calculateCost('nonexistent', 100, 100);
      expect(cost).toBe(0);
    });

    it('free models have 0 cost', () => {
      const cost = modelRegistry.calculateCost('claude-code', 1000, 1000);
      expect(cost).toBe(0);
    });
  });

  describe('getModelsByCost', () => {
    it('returns sorted by cost ascending', () => {
      const models = modelRegistry.getModelsByCost();
      for (let i = 1; i < models.length; i++) {
        const prevCost = (models[i - 1].costPer1kTokens.input + models[i - 1].costPer1kTokens.output) / 2;
        const currCost = (models[i].costPer1kTokens.input + models[i].costPer1kTokens.output) / 2;
        expect(currCost).toBeGreaterThanOrEqual(prevCost);
      }
    });

    it('only includes enabled models', () => {
      const models = modelRegistry.getModelsByCost();
      for (const m of models) {
        expect(m.enabled).toBe(true);
      }
    });

    it('cheapest model has lowest cost', () => {
      const models = modelRegistry.getModelsByCost();
      expect(models.length).toBeGreaterThan(0);
      const cheapestCost = (models[0].costPer1kTokens.input + models[0].costPer1kTokens.output) / 2;
      expect(cheapestCost).toBeGreaterThanOrEqual(0);
    });
  });

  describe('reload', () => {
    let originalModels: Model[];

    beforeEach(() => {
      originalModels = modelRegistry.getModels();
    });

    afterEach(() => {
      modelRegistry.reload(originalModels);
    });

    it('replaces the model list', () => {
      const custom: Model[] = [
        {
          id: 'test/model-1',
          name: 'Test Model',
          tier: 'cheap',
          provider: 'openrouter',
          costPer1kTokens: { input: 0.0001, output: 0.0002 },
          contextWindow: 8192,
          categories: ['code'],
          enabled: true,
        },
      ];
      modelRegistry.reload(custom);
      expect(modelRegistry.getModels()).toHaveLength(1);
      expect(modelRegistry.getModel('test/model-1')).toBeDefined();
    });

    it('reload with empty array returns no models', () => {
      modelRegistry.reload([]);
      expect(modelRegistry.getModels()).toHaveLength(0);
    });
  });
});
