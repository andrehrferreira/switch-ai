import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { loadConfig } from '../loader';

const ENV_KEYS = [
  'SWITCH_AI_PORT', 'SWITCH_AI_HOST', 'SWITCH_AI_CORS', 'SWITCH_AI_LOG_LEVEL',
  'SWITCH_AI_DEFAULT_TIER', 'SWITCH_AI_MAX_COST',
  'SWITCH_AI_MEMORY_ENABLED', 'SWITCH_AI_MEMORY_PATH', 'SWITCH_AI_MEMORY_RETENTION',
  'SWITCH_AI_LEARNING_ENABLED', 'SWITCH_AI_AUTO_BLACKLIST', 'SWITCH_AI_MIN_SUCCESS_THRESHOLD',
  'SWITCH_AI_VALIDATE', 'SWITCH_AI_ESCALATION_RETRIES', 'SWITCH_AI_TIMEOUT_MS',
];

const tmpDir = path.join(os.tmpdir(), `switch-ai-loader-test-${Date.now()}`);
const tmpConfigPath = path.join(tmpDir, 'config.json');

beforeEach(() => {
  ENV_KEYS.forEach((k) => delete process.env[k]);
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
});

afterEach(() => {
  ENV_KEYS.forEach((k) => delete process.env[k]);
  if (fs.existsSync(tmpConfigPath)) {
    fs.unlinkSync(tmpConfigPath);
  }
});

describe('loadConfig', () => {
  it('returns defaults when no file or env vars', () => {
    const config = loadConfig('/nonexistent/path/config.json');
    expect(config.server.port).toBe(4000);
    expect(config.server.host).toBe('localhost');
    expect(config.models.defaultTier).toBe('balanced');
    expect(config.memory.enabled).toBe(true);
    expect(config.learning.enabled).toBe(true);
    expect(config.validation.enabled).toBe(true);
  });

  it('env vars override defaults', () => {
    process.env['SWITCH_AI_PORT'] = '5000';
    process.env['SWITCH_AI_LOG_LEVEL'] = 'debug';
    process.env['SWITCH_AI_DEFAULT_TIER'] = 'cheap';

    const config = loadConfig('/nonexistent/path/config.json');
    expect(config.server.port).toBe(5000);
    expect(config.server.logLevel).toBe('debug');
    expect(config.models.defaultTier).toBe('cheap');
  });

  it('loads and merges a config file when it exists', () => {
    fs.writeFileSync(tmpConfigPath, JSON.stringify({ server: { port: 7777 } }));
    const config = loadConfig(tmpConfigPath);
    expect(config.server.port).toBe(7777);
  });

  it('env overrides config file', () => {
    fs.writeFileSync(tmpConfigPath, JSON.stringify({ server: { port: 7777 } }));
    process.env['SWITCH_AI_PORT'] = '8888';
    const config = loadConfig(tmpConfigPath);
    expect(config.server.port).toBe(8888);
  });

  it('throws ConfigError when config file is invalid JSON', () => {
    fs.writeFileSync(tmpConfigPath, 'not-valid-json');
    expect(() => loadConfig(tmpConfigPath)).toThrow();
  });

  it('invalid env port falls back to default', () => {
    process.env['SWITCH_AI_PORT'] = 'not-a-number';
    const config = loadConfig('/nonexistent/path/config.json');
    expect(config.server.port).toBe(4000);
  });

  it('memory env vars override defaults', () => {
    process.env['SWITCH_AI_MEMORY_PATH'] = '/custom/memory.db';
    process.env['SWITCH_AI_MEMORY_RETENTION'] = '30';
    const config = loadConfig('/nonexistent/path/config.json');
    expect(config.memory.path).toBe('/custom/memory.db');
    expect(config.memory.retentionDays).toBe(30);
  });

  it('learning env vars override defaults', () => {
    process.env['SWITCH_AI_LEARNING_ENABLED'] = 'false';
    process.env['SWITCH_AI_AUTO_BLACKLIST'] = 'false';
    const config = loadConfig('/nonexistent/path/config.json');
    expect(config.learning.enabled).toBe(false);
    expect(config.learning.autoBlacklist).toBe(false);
  });

  it('validation env vars override defaults', () => {
    process.env['SWITCH_AI_VALIDATE'] = 'false';
    process.env['SWITCH_AI_ESCALATION_RETRIES'] = '5';
    process.env['SWITCH_AI_TIMEOUT_MS'] = '10000';
    const config = loadConfig('/nonexistent/path/config.json');
    expect(config.validation.enabled).toBe(false);
    expect(config.validation.escalationRetries).toBe(5);
    expect(config.validation.timeoutMs).toBe(10000);
  });

  it('throws ConfigError when schema validation fails', () => {
    // Write a config file with an invalid schema (e.g., port is wrong type)
    // The schema uses zod which may coerce or reject - use an invalid tier value
    fs.writeFileSync(tmpConfigPath, JSON.stringify({ models: { defaultTier: 'invalid-tier' } }));
    expect(() => loadConfig(tmpConfigPath)).toThrow();
  });
});
