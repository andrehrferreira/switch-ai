export type TaskCategory =
  | 'documentation'
  | 'tests'
  | 'simpleCode'
  | 'complexCode'
  | 'research'
  | 'refactoring'
  | 'architecture';

export const BASE_SCORES: Record<TaskCategory, number> = {
  documentation: 1.5,
  tests: 2.0,
  simpleCode: 4.0,
  complexCode: 6.5,
  research: 5.5,
  refactoring: 6.5,
  architecture: 8.5,
};

export const CATEGORY_KEYWORDS: Record<TaskCategory, string[]> = {
  documentation: [
    'readme',
    'doc',
    'document',
    'guide',
    'tutorial',
    'explain',
    'comment',
    'docstring',
    'javadoc',
    'write',
    'describe',
    'documentation',
    'api doc',
    'changelog',
  ],
  tests: [
    'test',
    'unit test',
    'integration test',
    'spec',
    'test case',
    'mock',
    'testing',
    'jest',
    'vitest',
    'mocha',
    'chai',
  ],
  simpleCode: [
    'helper',
    'function',
    'utility',
    'simple',
    'fix',
    'bug',
    'patch',
    'quick',
    'small',
    'minor',
    'tweak',
    'adjust',
  ],
  complexCode: [
    'implement',
    'feature',
    'architecture',
    'system',
    'complex',
    'design',
    'pattern',
    'algorithm',
    'optimization',
    'refactor',
    'large',
    'module',
    'service',
  ],
  research: [
    'analyze',
    'research',
    'investigate',
    'compare',
    'evaluate',
    'assess',
    'study',
    'review',
    'examine',
    'why',
    'how does',
    'what is',
  ],
  refactoring: [
    'refactor',
    'cleanup',
    'improve',
    'optimize',
    'reorganize',
    'restructure',
    'rewrite',
    'clean up',
    'modernize',
  ],
  architecture: [
    'design',
    'architecture',
    'microservice',
    'distributed',
    'system design',
    'scalability',
    'infrastructure',
    'deployment',
    'infrastructure',
  ],
};

export const COMPLEXITY_BOOSTERS = {
  'very complex': 2,
  'super complex': 2.5,
  complex: 1,
  'difficult': 1,
  'tricky': 1,
  'edge case': 0.5,
  'production': 0.5,
  'critical': 0.5,
  'high priority': 0.5,
};

export const COMPLEXITY_REDUCERS = {
  simple: -1,
  easy: -1,
  basic: -0.5,
  quick: -0.5,
  'one line': -1,
  typo: -1,
  broken: -0.5,
  bug: -0.5,
};

export const LANGUAGE_COMPLEXITY: Record<string, number> = {
  typescript: 0,
  javascript: 0,
  python: 0,
  rust: 0.5,
  scala: 0.5,
  haskell: 1,
  'c++': 0.5,
  go: 0,
  sql: 0,
};
