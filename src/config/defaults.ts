import path from 'path';
import os from 'os';

const homeDir = os.homedir();

export const DEFAULTS = {
  server: {
    port: 4000,
    host: 'localhost',
    cors: true,
    logLevel: 'info' as const,
  },
  models: {
    defaultTier: 'balanced' as const,
    maxCostPerRequest: 0.1,
  },
  memory: {
    enabled: true,
    path: path.join(homeDir, '.switch-ai'),
    retentionDays: 90,
  },
  learning: {
    enabled: true,
    autoBlacklist: true,
    minSuccessThreshold: 0.3,
  },
  validation: {
    enabled: true,
    escalationRetries: 2,
    timeoutMs: 30000,
  },
} as const;
