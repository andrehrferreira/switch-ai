import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/logger', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { quotaManager } from '../quota-manager';

describe('QuotaManager', () => {
  beforeEach(() => {
    // Reset internal state by marking models as available
    quotaManager.markAvailable('test-model');
    quotaManager.markAvailable('other-model');
  });

  describe('markExhausted', () => {
    it('marks a model as exhausted', () => {
      quotaManager.markExhausted('test-model');
      expect(quotaManager.isExhausted('test-model')).toBe(true);
    });

    it('marks a model as exhausted with custom retry-after seconds', () => {
      quotaManager.markExhausted('test-model', 120);
      expect(quotaManager.isExhausted('test-model')).toBe(true);
    });

    it('uses default TTL when no retryAfterSeconds provided', () => {
      quotaManager.markExhausted('test-model');
      expect(quotaManager.getStatus('test-model')).toBe('exhausted');
    });
  });

  describe('isExhausted', () => {
    it('returns false for unknown model', () => {
      expect(quotaManager.isExhausted('unknown-model')).toBe(false);
    });

    it('returns false for available model', () => {
      quotaManager.markAvailable('test-model');
      expect(quotaManager.isExhausted('test-model')).toBe(false);
    });

    it('returns true for exhausted model within TTL', () => {
      quotaManager.markExhausted('test-model', 3600);
      expect(quotaManager.isExhausted('test-model')).toBe(true);
    });

    it('returns false and clears quota when resetAt has passed', () => {
      // Mark exhausted with 0 seconds (already expired)
      vi.useFakeTimers();
      quotaManager.markExhausted('test-model', 1);
      // Advance time past the reset
      vi.advanceTimersByTime(2000);
      expect(quotaManager.isExhausted('test-model')).toBe(false);
      vi.useRealTimers();
    });
  });

  describe('markAvailable', () => {
    it('marks a model as available', () => {
      quotaManager.markExhausted('test-model');
      quotaManager.markAvailable('test-model');
      expect(quotaManager.isExhausted('test-model')).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('returns unknown for model never seen', () => {
      expect(quotaManager.getStatus('never-seen-model')).toBe('unknown');
    });

    it('returns available for available model', () => {
      quotaManager.markAvailable('test-model');
      expect(quotaManager.getStatus('test-model')).toBe('available');
    });

    it('returns exhausted for exhausted model', () => {
      quotaManager.markExhausted('test-model', 3600);
      expect(quotaManager.getStatus('test-model')).toBe('exhausted');
    });

    it('returns available after exhaustion expires', () => {
      vi.useFakeTimers();
      quotaManager.markExhausted('test-model', 1);
      vi.advanceTimersByTime(2000);
      // isExhausted clears the entry, getStatus should then fall through
      expect(quotaManager.getStatus('test-model')).toBe('unknown');
      vi.useRealTimers();
    });
  });
});
