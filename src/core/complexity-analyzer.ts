import {
  TaskCategory,
  BASE_SCORES,
  CATEGORY_KEYWORDS,
  COMPLEXITY_BOOSTERS,
  COMPLEXITY_REDUCERS,
} from './keywords';

export interface ComplexityResult {
  score: number; // 1-10
  category: TaskCategory;
  confidence: number; // 0-1
  reasoning: string;
}

function detectCategory(text: string): TaskCategory {
  const lowerText = text.toLowerCase();
  let bestCategory: TaskCategory = 'simpleCode';
  let maxMatches = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const matches = keywords.filter((kw) => lowerText.includes(kw)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      bestCategory = category as TaskCategory;
    }
  }

  return bestCategory;
}

function applyModifiers(score: number, text: string): number {
  const lowerText = text.toLowerCase();
  let modified = score;

  // Apply boosters
  for (const [keyword, boost] of Object.entries(COMPLEXITY_BOOSTERS)) {
    if (lowerText.includes(keyword.toLowerCase())) {
      modified += boost;
    }
  }

  // Apply reducers
  for (const [keyword, reduction] of Object.entries(COMPLEXITY_REDUCERS)) {
    if (lowerText.includes(keyword.toLowerCase())) {
      modified += reduction;
    }
  }

  return modified;
}

export function analyzeComplexity(prompt: string): ComplexityResult {
  const category = detectCategory(prompt);
  let score = BASE_SCORES[category];

  // Apply modifiers
  score = applyModifiers(score, prompt);

  // Clamp to 1-10
  score = Math.max(1, Math.min(10, score));

  // Calculate confidence (higher if more keywords matched)
  const lowerPrompt = prompt.toLowerCase();
  const matchedKeywords = CATEGORY_KEYWORDS[category].filter((kw) =>
    lowerPrompt.includes(kw)
  ).length;
  const maxPossibleMatches = CATEGORY_KEYWORDS[category].length;
  const confidence = Math.min(0.95, 0.5 + (matchedKeywords / maxPossibleMatches) * 0.45);

  // Generate reasoning
  const reasoning = `Detected '${category}' task with score ${score.toFixed(1)}/10 based on keywords (${matchedKeywords} matches)`;

  return {
    score: Math.round(score * 2) / 2, // Round to nearest 0.5
    category,
    confidence: Math.round(confidence * 100) / 100,
    reasoning,
  };
}

/**
 * Get recommended model tier for a complexity score
 */
export function getTierForComplexity(score: number): 'free' | 'cheap' | 'balanced' | 'premium' {
  if (score <= 3) return 'free';
  if (score <= 5) return 'cheap';
  if (score <= 7) return 'balanced';
  return 'premium';
}
