export { default as databaseManager } from './db';
export type {
  RequestRecord,
  ModelPerformance,
  FailurePattern,
  Escalation,
  CostAnalysis,
  ModelRating,
} from './types';

export { recordRequest, updateModelPerformance } from './recorder';
export type { RecordData } from './recorder';

export {
  recordFailure,
  getBlacklistedModels,
  isModelBlacklisted,
  clearBlacklist,
  FAILURE_THRESHOLD,
} from './learning';

export { getModelPerformance, getCostSummary, getTopModels, getAllRequests } from './analytics';
export type { CostSummary } from './analytics';
