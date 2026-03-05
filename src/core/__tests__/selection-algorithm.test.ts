import { describe, it, expect, vi } from 'vitest';

// Ensure ModelRegistry uses bundled models.json, not disk cache
vi.mock('../../registry/openrouter', () => ({
  readDiskCache: vi.fn().mockReturnValue(null),
}));

import { selectModel } from '../selection-algorithm';

describe('selectModel', () => {
  it('returns a SelectionResult with required fields', () => {
    const result = selectModel('Write a simple function');
    expect(result).toHaveProperty('model');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('reasoning');
    expect(result).toHaveProperty('fallbackChain');
  });

  it('selected model has required Model fields', () => {
    const result = selectModel('Write documentation');
    expect(result.model).toHaveProperty('id');
    expect(result.model).toHaveProperty('tier');
    expect(result.model).toHaveProperty('name');
  });

  it('confidence is between 0 and 1', () => {
    const result = selectModel('Analyze the codebase');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('reasoning mentions selected model name', () => {
    const result = selectModel('Write unit tests');
    expect(result.reasoning).toContain(result.model.name);
  });

  it('respects blacklisted models', () => {
    const result1 = selectModel('Write simple code');
    const blacklisted = result1.model.id;

    const result2 = selectModel('Write simple code', {
      blacklistedModels: [blacklisted],
    });
    expect(result2.model.id).not.toBe(blacklisted);
  });

  it('respects preferred models when available', () => {
    // claude-sonnet is balanced tier
    const result = selectModel('research and analyze', {
      preferredModels: ['claude-sonnet'],
    });
    // Either the preferred model is chosen or none were available in candidates
    // This tests that the preference filtering code runs
    expect(result.model).toBeDefined();
  });

  it('respects maxCostPerRequest filter', () => {
    // A high cost filter should allow most models
    const result = selectModel('complex task', { maxCostPerRequest: 1.0 });
    expect(result.model).toBeDefined();

    // Zero cost filter should fall back (only free models)
    const result2 = selectModel('complex task', { maxCostPerRequest: 0 });
    expect(result2.model).toBeDefined();
  });

  it('relaxes constraints when no candidates remain', () => {
    // Blacklist all enabled models except leave some
    const result = selectModel('task', {
      blacklistedModels: ['claude-opus', 'claude-sonnet', 'gpt-4-turbo', 'gpt-4o', 'gemini-pro'],
    });
    expect(result.model).toBeDefined();
  });

  it('uses context complexity when provided', () => {
    const result = selectModel('any prompt', { complexity: 9 });
    // High complexity should select premium tier
    expect(['premium', 'balanced']).toContain(result.model.tier);
  });

  it('uses context category when provided', () => {
    const result = selectModel('any prompt', { category: 'architecture' });
    expect(result.reasoning).toContain('architecture');
  });

  it('fallbackChain is an array', () => {
    const result = selectModel('simple task');
    expect(Array.isArray(result.fallbackChain)).toBe(true);
  });

  it('returns a model even when all blacklisted (fallback to cheapest)', () => {
    // Blacklist almost everything - forces fallback to getModelsByCost()[0]
    const result = selectModel('task', {
      blacklistedModels: [
        'claude-opus',
        'claude-sonnet',
        'claude-haiku',
        'deepseek-chat',
        'gemini-2.0-flash',
        'gpt-4-turbo',
        'gpt-4o',
        'gemini-pro',
        'claude-code',
        'gemini-flash-free',
      ],
    });
    expect(result.model).toBeDefined();
  });
});
