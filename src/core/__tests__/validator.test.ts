import { describe, it, expect } from 'vitest';
import { validateResponse } from '../validator';
import type { AnthropicResponse } from '../../server/types';

function makeResponse(text: string): AnthropicResponse {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text }],
    model: 'test/model',
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 5, output_tokens: 10 },
  };
}

describe('validateResponse', () => {
  it('passes for a normal response', () => {
    const result = validateResponse(makeResponse('Here is the answer to your question.'), 20);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
    expect(result.issues).toHaveLength(0);
  });

  it('fails for empty response', () => {
    const result = validateResponse(makeResponse(''), 10);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain('empty_response');
  });

  it('fails for whitespace-only response', () => {
    const result = validateResponse(makeResponse('   '), 10);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain('empty_response');
  });

  it('fails for suspiciously short response on long prompt', () => {
    const result = validateResponse(makeResponse('Yes.'), 100);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain('suspiciously_short');
  });

  it('passes short response for short prompt (<=50 chars)', () => {
    const result = validateResponse(makeResponse('Yes.'), 30);
    expect(result.passed).toBe(true);
  });

  it('fails for refusal pattern "I am sorry"', () => {
    const result = validateResponse(makeResponse("I am sorry, I can't help."), 10);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain('possible_refusal');
  });

  it('fails for refusal pattern "I\'m sorry"', () => {
    const result = validateResponse(makeResponse("I'm sorry, that is not possible."), 10);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain('possible_refusal');
  });

  it('fails for refusal pattern "I cannot"', () => {
    const result = validateResponse(makeResponse('I cannot fulfill this request.'), 10);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain('possible_refusal');
  });

  it('fails for refusal pattern "error:"', () => {
    const result = validateResponse(makeResponse('Error: something went wrong'), 10);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain('possible_refusal');
  });

  it('fails for truncated response ending in ...', () => {
    const result = validateResponse(makeResponse('The answer is somewhere in the middle...'), 10);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain('truncated');
  });

  it('fails for [truncated] marker', () => {
    const result = validateResponse(makeResponse('Here is the output [truncated]'), 10);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain('truncated');
  });

  it('fails for [cut off] marker', () => {
    const result = validateResponse(makeResponse('Partial response [cut off]'), 10);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain('truncated');
  });

  it('score decreases with each issue', () => {
    const oneIssue = validateResponse(makeResponse(''), 10);
    expect(oneIssue.score).toBe(0.75);

    const twoIssues = validateResponse(makeResponse(''), 100);
    expect(twoIssues.score).toBe(0.5);
  });

  it('score is clamped to 0 with 4+ issues', () => {
    // empty + short + refusal + truncated
    const result = validateResponse(makeResponse('I cannot...'), 100);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('joins content from multiple content blocks', () => {
    const response: AnthropicResponse = {
      id: 'msg_multi',
      type: 'message',
      role: 'assistant',
      content: [
        { type: 'text', text: 'Part one. ' },
        { type: 'text', text: 'Part two.' },
      ],
      model: 'test/model',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 5, output_tokens: 10 },
    };
    const result = validateResponse(response, 10);
    expect(result.passed).toBe(true);
  });

  it('handles empty content array', () => {
    const response: AnthropicResponse = {
      id: 'msg_empty',
      type: 'message',
      role: 'assistant',
      content: [],
      model: 'test/model',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    };
    const result = validateResponse(response, 10);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain('empty_response');
  });
});
