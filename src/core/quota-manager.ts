
import logger from '../utils/logger';

export type QuotaStatus = 'available' | 'exhausted' | 'unknown';

interface ModelQuota {
  status: QuotaStatus;
  lastChecked: number;
  resetAt?: number;
}

class QuotaManager {
  private quotas: Map<string, ModelQuota> = new Map();
  private readonly EXHAUSTED_TTL = 1000 * 60 * 60; // 1 hour by default

  markExhausted(modelId: string, retryAfterSeconds?: number): void {
    const resetAt = retryAfterSeconds 
      ? Date.now() + (retryAfterSeconds * 1000)
      : Date.now() + this.EXHAUSTED_TTL;
    
    this.quotas.set(modelId, {
      status: 'exhausted',
      lastChecked: Date.now(),
      resetAt
    });
    
    logger.warn(`Quota exhausted for ${modelId}. Will retry after ${new Date(resetAt).toISOString()}`);
  }

  isExhausted(modelId: string): boolean {
    const quota = this.quotas.get(modelId);
    if (!quota) return false;
    
    if (quota.status === 'exhausted') {
      if (quota.resetAt && Date.now() > quota.resetAt) {
        this.quotas.delete(modelId);
        return false;
      }
      return true;
    }
    
    return false;
  }

  markAvailable(modelId: string): void {
    this.quotas.set(modelId, {
      status: 'available',
      lastChecked: Date.now()
    });
  }

  getStatus(modelId: string): QuotaStatus {
    if (this.isExhausted(modelId)) return 'exhausted';
    return this.quotas.get(modelId)?.status ?? 'unknown';
  }
}

export const quotaManager = new QuotaManager();
