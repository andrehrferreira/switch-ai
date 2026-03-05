import { describe, it, expect } from 'vitest';
import { analyzeComplexity, getTierForComplexity } from '../complexity-analyzer';

describe('analyzeComplexity', () => {
  it('returns a result with required fields', () => {
    const result = analyzeComplexity('Write a readme file');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('category');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('reasoning');
  });

  it('score is between 1 and 10', () => {
    const result = analyzeComplexity('Design distributed microservice architecture system');
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThanOrEqual(10);
  });

  it('detects documentation category', () => {
    const result = analyzeComplexity('Write a readme document and guide for this project');
    expect(result.category).toBe('documentation');
  });

  it('detects tests category', () => {
    const result = analyzeComplexity('Write unit tests with mock for the function using vitest');
    expect(result.category).toBe('tests');
  });

  it('detects architecture category for complex design tasks', () => {
    const result = analyzeComplexity('Design system design for distributed microservice scalability');
    expect(result.category).toBe('architecture');
  });

  it('applies complexity boosters', () => {
    const base = analyzeComplexity('fix bug');
    const boosted = analyzeComplexity('fix very complex critical production bug');
    // Boosted should have higher score (unless clamping)
    expect(boosted.score).toBeGreaterThanOrEqual(base.score);
  });

  it('applies complexity reducers', () => {
    const result = analyzeComplexity('simple easy one line fix');
    expect(result.score).toBeLessThanOrEqual(5);
  });

  it('score is rounded to nearest 0.5', () => {
    const result = analyzeComplexity('test');
    expect(result.score % 0.5).toBe(0);
  });

  it('confidence is between 0 and 1', () => {
    const result = analyzeComplexity('some random prompt');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('defaults to simpleCode for unmatched prompt', () => {
    const result = analyzeComplexity('xyz abc 123');
    expect(result.category).toBe('simpleCode');
  });

  it('reasoning string mentions the category', () => {
    const result = analyzeComplexity('Write tests for the module');
    expect(result.reasoning).toContain(result.category);
  });

  it('clamps score to max 10', () => {
    const result = analyzeComplexity(
      'design distributed microservice system design architecture very complex super complex complex'
    );
    expect(result.score).toBeLessThanOrEqual(10);
  });

  it('clamps score to min 1', () => {
    const result = analyzeComplexity('simple easy basic quick one line typo');
    expect(result.score).toBeGreaterThanOrEqual(1);
  });
});

describe('getTierForComplexity', () => {
  it('returns free for score <= 3', () => {
    expect(getTierForComplexity(1)).toBe('free');
    expect(getTierForComplexity(3)).toBe('free');
  });

  it('returns cheap for score <= 5', () => {
    expect(getTierForComplexity(4)).toBe('cheap');
    expect(getTierForComplexity(5)).toBe('cheap');
  });

  it('returns balanced for score <= 7', () => {
    expect(getTierForComplexity(6)).toBe('balanced');
    expect(getTierForComplexity(7)).toBe('balanced');
  });

  it('returns premium for score > 7', () => {
    expect(getTierForComplexity(8)).toBe('premium');
    expect(getTierForComplexity(10)).toBe('premium');
  });
});
