import { describe, it, expect } from 'vitest';
import { DEFAULTS } from '../defaults';

describe('DEFAULTS', () => {
  it('has server defaults', () => {
    expect(DEFAULTS.server.port).toBe(4000);
    expect(DEFAULTS.server.host).toBe('localhost');
    expect(DEFAULTS.server.cors).toBe(true);
    expect(DEFAULTS.server.logLevel).toBe('info');
  });

  it('has models defaults', () => {
    expect(DEFAULTS.models.defaultTier).toBe('balanced');
    expect(DEFAULTS.models.maxCostPerRequest).toBe(0.1);
  });

  it('has memory defaults', () => {
    expect(DEFAULTS.memory.enabled).toBe(true);
    expect(DEFAULTS.memory.retentionDays).toBe(90);
    expect(typeof DEFAULTS.memory.path).toBe('string');
  });

  it('has learning defaults', () => {
    expect(DEFAULTS.learning.enabled).toBe(true);
    expect(DEFAULTS.learning.autoBlacklist).toBe(true);
    expect(DEFAULTS.learning.minSuccessThreshold).toBe(0.3);
  });

  it('has validation defaults', () => {
    expect(DEFAULTS.validation.enabled).toBe(true);
    expect(DEFAULTS.validation.escalationRetries).toBe(2);
    expect(DEFAULTS.validation.timeoutMs).toBe(30000);
  });
});
