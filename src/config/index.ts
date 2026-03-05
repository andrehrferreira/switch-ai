import { loadConfig } from './loader';
import type { Config } from './schema';

class ConfigManager {
  private config: Config | null = null;

  load(): Config {
    if (!this.config) {
      this.config = loadConfig();
    }
    return this.config;
  }

  get(): Config {
    if (!this.config) {
      this.config = loadConfig();
    }
    return this.config;
  }

  getServer() {
    return this.get().server;
  }

  getModels() {
    return this.get().models;
  }

  getMemory() {
    return this.get().memory;
  }

  getLearning() {
    return this.get().learning;
  }

  getValidation() {
    return this.get().validation;
  }
}

// Singleton instance
const configManager = new ConfigManager();

export default configManager;
export type { Config };
