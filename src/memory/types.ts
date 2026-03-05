export interface RequestRecord {
  id: string;
  timestamp: string;
  prompt: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  complexity_score: number | null;
  category: string | null;
  initial_model: string;
  final_model: string;
  escalations: number;
  status: 'success' | 'failure' | 'timeout' | 'error';
  validation_passed: boolean | null;
  latency_ms: number | null;
  cost: number | null;
}

export interface ModelPerformance {
  model: string;
  category: string;
  attempts: number;
  successes: number;
  failures: number;
  success_rate: number | null;
  avg_latency_ms: number | null;
  avg_cost: number | null;
  last_used: string | null;
}

export interface FailurePattern {
  id: number;
  model: string;
  category: string;
  error_type: string;
  count: number;
  blacklist_until: string | null;
}

export interface Escalation {
  id: number;
  request_id: string;
  from_model: string;
  to_model: string;
  category: string | null;
  reason: string | null;
}

export interface CostAnalysis {
  id: number;
  period: string;
  total_requests: number;
  total_cost: number;
}

export interface ModelRating {
  model: string;
  overall_score: number | null;
  documentation_score: number | null;
  tests_score: number | null;
  code_score: number | null;
  last_updated: string | null;
}
