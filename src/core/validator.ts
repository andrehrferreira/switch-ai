import type { AnthropicResponse } from '../server/types';

export interface ValidationResult {
  passed: boolean;
  score: number; // 0.0–1.0
  issues: string[];
}

export function validateResponse(
  response: AnthropicResponse,
  promptLength: number
): ValidationResult {
  const hasToolUse = response.content.some((c) => c.type === 'tool_use');

  // Tool-use responses are always valid — don't validate as text
  if (hasToolUse) {
    return { passed: true, score: 1, issues: [] };
  }

  const text = response.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('');
  const issues: string[] = [];

  if (!text.trim()) {
    issues.push('empty_response');
  }

  if (promptLength > 50 && text.length < 20) {
    issues.push('suspiciously_short');
  }

  if (/^(error:|i('m| am) sorry,|i cannot|i'm unable)/i.test(text.trim())) {
    issues.push('possible_refusal');
  }

  if (text.trimEnd().endsWith('...') || /\[(?:cut off|truncated)\]/i.test(text)) {
    issues.push('truncated');
  }

  const score = Math.max(0, 1 - issues.length * 0.25);

  return {
    passed: issues.length === 0,
    score: Math.round(score * 100) / 100,
    issues,
  };
}
