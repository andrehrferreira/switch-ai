import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ConfigManager', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns a config with expected shape on get()', async () => {
    const { default: configManager } = await import('../index');
    const config = configManager.get();
    expect(config).toHaveProperty('server');
    expect(config).toHaveProperty('models');
    expect(config).toHaveProperty('memory');
    expect(config).toHaveProperty('learning');
    expect(config).toHaveProperty('validation');
  });

  it('load() returns same object as get()', async () => {
    const { default: configManager } = await import('../index');
    expect(configManager.load()).toStrictEqual(configManager.get());
  });

  it('getServer() returns server config', async () => {
    const { default: configManager } = await import('../index');
    expect(configManager.getServer().port).toBe(4000);
  });

  it('getModels() returns models config', async () => {
    const { default: configManager } = await import('../index');
    expect(configManager.getModels().defaultTier).toBe('balanced');
  });

  it('getMemory() returns memory config', async () => {
    const { default: configManager } = await import('../index');
    expect(configManager.getMemory().enabled).toBe(true);
  });

  it('getLearning() returns learning config', async () => {
    const { default: configManager } = await import('../index');
    expect(configManager.getLearning().enabled).toBe(true);
  });

  it('getValidation() returns validation config', async () => {
    const { default: configManager } = await import('../index');
    expect(configManager.getValidation().enabled).toBe(true);
  });
});
