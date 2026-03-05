import { describe, it, expect } from 'vitest';
import {
  BASE_SCORES,
  CATEGORY_KEYWORDS,
  COMPLEXITY_BOOSTERS,
  COMPLEXITY_REDUCERS,
  LANGUAGE_COMPLEXITY,
} from '../keywords';
import type { TaskCategory } from '../keywords';

const ALL_CATEGORIES: TaskCategory[] = [
  'documentation',
  'tests',
  'simpleCode',
  'complexCode',
  'research',
  'refactoring',
  'architecture',
];

describe('BASE_SCORES', () => {
  it('has all 7 categories', () => {
    expect(Object.keys(BASE_SCORES)).toHaveLength(7);
  });

  it('all scores are positive numbers', () => {
    for (const score of Object.values(BASE_SCORES)) {
      expect(score).toBeGreaterThan(0);
    }
  });

  it('has expected scores for each category', () => {
    expect(BASE_SCORES.documentation).toBe(1.5);
    expect(BASE_SCORES.tests).toBe(2.0);
    expect(BASE_SCORES.simpleCode).toBe(4.0);
    expect(BASE_SCORES.complexCode).toBe(6.5);
    expect(BASE_SCORES.research).toBe(5.5);
    expect(BASE_SCORES.refactoring).toBe(6.5);
    expect(BASE_SCORES.architecture).toBe(8.5);
  });
});

describe('CATEGORY_KEYWORDS', () => {
  it('has keywords for all 7 categories', () => {
    for (const category of ALL_CATEGORIES) {
      expect(CATEGORY_KEYWORDS).toHaveProperty(category);
      expect(CATEGORY_KEYWORDS[category].length).toBeGreaterThan(0);
    }
  });

  it('documentation keywords include readme and doc', () => {
    expect(CATEGORY_KEYWORDS.documentation).toContain('readme');
    expect(CATEGORY_KEYWORDS.documentation).toContain('doc');
  });

  it('tests keywords include test and mock', () => {
    expect(CATEGORY_KEYWORDS.tests).toContain('test');
    expect(CATEGORY_KEYWORDS.tests).toContain('mock');
  });
});

describe('COMPLEXITY_BOOSTERS', () => {
  it('complex has boost of 1', () => {
    expect(COMPLEXITY_BOOSTERS['complex']).toBe(1);
  });

  it('very complex has boost of 2', () => {
    expect(COMPLEXITY_BOOSTERS['very complex']).toBe(2);
  });

  it('all boosts are positive', () => {
    for (const boost of Object.values(COMPLEXITY_BOOSTERS)) {
      expect(boost).toBeGreaterThan(0);
    }
  });
});

describe('COMPLEXITY_REDUCERS', () => {
  it('simple has reduction of -1', () => {
    expect(COMPLEXITY_REDUCERS.simple).toBe(-1);
  });

  it('all reducers are negative', () => {
    for (const reduction of Object.values(COMPLEXITY_REDUCERS)) {
      expect(reduction).toBeLessThan(0);
    }
  });
});

describe('LANGUAGE_COMPLEXITY', () => {
  it('has entries for common languages', () => {
    expect(LANGUAGE_COMPLEXITY).toHaveProperty('typescript');
    expect(LANGUAGE_COMPLEXITY).toHaveProperty('python');
    expect(LANGUAGE_COMPLEXITY).toHaveProperty('rust');
  });

  it('haskell has highest complexity', () => {
    expect(LANGUAGE_COMPLEXITY.haskell).toBeGreaterThan(LANGUAGE_COMPLEXITY.typescript);
  });
});
