import { describe, it, expect } from 'vitest';
import { ConfigSchema } from '../schema';

const validConfig = {
  server: { port: 4000, host: 'localhost', cors: true, logLevel: 'info' as const },
  models: { defaultTier: 'balanced' as const, maxCostPerRequest: 0.1 },
  memory: { enabled: true, path: '/tmp', retentionDays: 90 },
  learning: { enabled: true, autoBlacklist: true, minSuccessThreshold: 0.3 },
  validation: { enabled: true, escalationRetries: 2, timeoutMs: 30000 },
};

describe('ConfigSchema', () => {
  it('accepts a valid config', () => {
    expect(ConfigSchema.safeParse(validConfig).success).toBe(true);
  });

  it('rejects invalid port', () => {
    const result = ConfigSchema.safeParse({ ...validConfig, server: { ...validConfig.server, port: -1 } });
    expect(result.success).toBe(false);
  });

  it('rejects invalid logLevel', () => {
    const result = ConfigSchema.safeParse({ ...validConfig, server: { ...validConfig.server, logLevel: 'verbose' } });
    expect(result.success).toBe(false);
  });

  it('rejects invalid defaultTier', () => {
    const result = ConfigSchema.safeParse({ ...validConfig, models: { ...validConfig.models, defaultTier: 'ultra' } });
    expect(result.success).toBe(false);
  });

  it('rejects negative maxCostPerRequest', () => {
    const result = ConfigSchema.safeParse({ ...validConfig, models: { ...validConfig.models, maxCostPerRequest: -1 } });
    expect(result.success).toBe(false);
  });

  it('rejects minSuccessThreshold out of range', () => {
    const result = ConfigSchema.safeParse({ ...validConfig, learning: { ...validConfig.learning, minSuccessThreshold: 1.5 } });
    expect(result.success).toBe(false);
  });

  it('rejects missing required field', () => {
    const { server: _, ...noServer } = validConfig;
    expect(ConfigSchema.safeParse(noServer).success).toBe(false);
  });
});
