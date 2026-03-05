import fs from 'fs';
import path from 'path';
import os from 'os';
import { parseEnvInt, parseEnvBool, parseEnvString } from '../utils/env';
import { ConfigError } from '../utils/errors';
import { ConfigSchema, type Config } from './schema';
import { DEFAULTS } from './defaults';

const DEFAULT_CONFIG_PATH = path.join(os.homedir(), '.switch-ai', 'config.json');

function loadConfigFile(configPath: string): Partial<Config> {
  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as Partial<Config>;
  } catch (error) {
    throw new ConfigError(`Failed to load config file: ${String(error)}`);
  }
}

function loadEnvVars(): Partial<Config> {
  const env: Partial<Config> = {};
  const e = process.env;

  if (e['SWITCH_AI_PORT'] || e['SWITCH_AI_HOST'] || e['SWITCH_AI_CORS'] || e['SWITCH_AI_LOG_LEVEL']) {
    env.server = {
      port: parseEnvInt('SWITCH_AI_PORT', DEFAULTS.server.port),
      host: parseEnvString('SWITCH_AI_HOST', DEFAULTS.server.host),
      cors: parseEnvBool('SWITCH_AI_CORS', DEFAULTS.server.cors),
      logLevel: parseEnvString('SWITCH_AI_LOG_LEVEL', DEFAULTS.server.logLevel) as Config['server']['logLevel'],
    };
  }

  if (e['SWITCH_AI_DEFAULT_TIER'] || e['SWITCH_AI_MAX_COST']) {
    env.models = {
      defaultTier: parseEnvString('SWITCH_AI_DEFAULT_TIER', DEFAULTS.models.defaultTier) as Config['models']['defaultTier'],
      maxCostPerRequest: parseEnvInt('SWITCH_AI_MAX_COST', DEFAULTS.models.maxCostPerRequest),
    };
  }

  if (e['SWITCH_AI_MEMORY_ENABLED'] || e['SWITCH_AI_MEMORY_PATH'] || e['SWITCH_AI_MEMORY_RETENTION']) {
    env.memory = {
      enabled: parseEnvBool('SWITCH_AI_MEMORY_ENABLED', DEFAULTS.memory.enabled),
      path: parseEnvString('SWITCH_AI_MEMORY_PATH', DEFAULTS.memory.path),
      retentionDays: parseEnvInt('SWITCH_AI_MEMORY_RETENTION', DEFAULTS.memory.retentionDays),
    };
  }

  if (e['SWITCH_AI_LEARNING_ENABLED'] || e['SWITCH_AI_AUTO_BLACKLIST'] || e['SWITCH_AI_MIN_SUCCESS_THRESHOLD']) {
    env.learning = {
      enabled: parseEnvBool('SWITCH_AI_LEARNING_ENABLED', DEFAULTS.learning.enabled),
      autoBlacklist: parseEnvBool('SWITCH_AI_AUTO_BLACKLIST', DEFAULTS.learning.autoBlacklist),
      minSuccessThreshold: parseEnvInt('SWITCH_AI_MIN_SUCCESS_THRESHOLD', Math.round(DEFAULTS.learning.minSuccessThreshold * 100)) / 100,
    };
  }

  if (e['SWITCH_AI_VALIDATE'] || e['SWITCH_AI_ESCALATION_RETRIES'] || e['SWITCH_AI_TIMEOUT_MS']) {
    env.validation = {
      enabled: parseEnvBool('SWITCH_AI_VALIDATE', DEFAULTS.validation.enabled),
      escalationRetries: parseEnvInt('SWITCH_AI_ESCALATION_RETRIES', DEFAULTS.validation.escalationRetries),
      timeoutMs: parseEnvInt('SWITCH_AI_TIMEOUT_MS', DEFAULTS.validation.timeoutMs),
    };
  }

  return env;
}

export function loadConfig(configFilePath?: string): Config {
  const fileConfig = loadConfigFile(configFilePath ?? DEFAULT_CONFIG_PATH);
  const envConfig = loadEnvVars();

  // Merge: defaults < file < env
  const merged = {
    ...DEFAULTS,
    server: { ...DEFAULTS.server, ...fileConfig.server, ...envConfig.server },
    models: { ...DEFAULTS.models, ...fileConfig.models, ...envConfig.models },
    memory: { ...DEFAULTS.memory, ...fileConfig.memory, ...envConfig.memory },
    learning: { ...DEFAULTS.learning, ...fileConfig.learning, ...envConfig.learning },
    validation: { ...DEFAULTS.validation, ...fileConfig.validation, ...envConfig.validation },
  };

  // Validate against schema
  const result = ConfigSchema.safeParse(merged);
  if (!result.success) {
    throw new ConfigError(`Invalid configuration: ${result.error.message}`);
  }

  return result.data;
}
