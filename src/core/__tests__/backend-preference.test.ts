import { describe, it, expect, beforeEach } from 'vitest';
import { getForcedBackend, setForcedBackend, type ForcedBackend } from '../backend-preference';

describe('backend-preference', () => {
  beforeEach(() => {
    setForcedBackend('auto');
  });

  it('defaults to auto', () => {
    expect(getForcedBackend()).toBe('auto');
  });

  it('sets and gets claude-cli', () => {
    setForcedBackend('claude-cli');
    expect(getForcedBackend()).toBe('claude-cli');
  });

  it('sets and gets gemini-cli', () => {
    setForcedBackend('gemini-cli');
    expect(getForcedBackend()).toBe('gemini-cli');
  });

  it('sets and gets cursor-cli', () => {
    setForcedBackend('cursor-cli');
    expect(getForcedBackend()).toBe('cursor-cli');
  });

  it('sets and gets gemini-api', () => {
    setForcedBackend('gemini-api');
    expect(getForcedBackend()).toBe('gemini-api');
  });

  it('sets and gets openrouter', () => {
    setForcedBackend('openrouter');
    expect(getForcedBackend()).toBe('openrouter');
  });

  it('overwrites previous value', () => {
    setForcedBackend('claude-cli');
    expect(getForcedBackend()).toBe('claude-cli');
    setForcedBackend('openrouter');
    expect(getForcedBackend()).toBe('openrouter');
  });

  it('can reset back to auto', () => {
    setForcedBackend('gemini-api');
    setForcedBackend('auto');
    expect(getForcedBackend()).toBe('auto');
  });
});
