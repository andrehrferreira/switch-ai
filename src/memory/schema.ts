export const SCHEMA = {
  requests: `
    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      prompt TEXT,
      tokens_input INTEGER,
      tokens_output INTEGER,
      complexity_score INTEGER,
      category TEXT,
      initial_model TEXT NOT NULL,
      final_model TEXT NOT NULL,
      escalations INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL CHECK(status IN ('success', 'failure', 'timeout', 'error')),
      validation_passed INTEGER,
      latency_ms INTEGER,
      cost REAL
    )
  `,

  model_performance: `
    CREATE TABLE IF NOT EXISTS model_performance (
      model TEXT NOT NULL,
      category TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      successes INTEGER NOT NULL DEFAULT 0,
      failures INTEGER NOT NULL DEFAULT 0,
      success_rate REAL,
      avg_latency_ms REAL,
      avg_cost REAL,
      last_used TEXT,
      PRIMARY KEY (model, category)
    )
  `,

  failure_patterns: `
    CREATE TABLE IF NOT EXISTS failure_patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model TEXT NOT NULL,
      category TEXT NOT NULL,
      error_type TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 1,
      blacklist_until TEXT,
      first_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,

  escalations: `
    CREATE TABLE IF NOT EXISTS escalations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT NOT NULL,
      from_model TEXT NOT NULL,
      to_model TEXT NOT NULL,
      category TEXT,
      reason TEXT,
      timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (request_id) REFERENCES requests(id)
    )
  `,

  cost_analysis: `
    CREATE TABLE IF NOT EXISTS cost_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period TEXT NOT NULL,
      total_requests INTEGER NOT NULL,
      total_cost REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,

  model_ratings: `
    CREATE TABLE IF NOT EXISTS model_ratings (
      model TEXT PRIMARY KEY,
      overall_score REAL,
      documentation_score REAL,
      tests_score REAL,
      code_score REAL,
      last_updated TEXT
    )
  `,
};

export const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON requests(timestamp)',
  'CREATE INDEX IF NOT EXISTS idx_requests_category ON requests(category)',
  'CREATE INDEX IF NOT EXISTS idx_requests_model ON requests(final_model)',
  'CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status)',
  'CREATE INDEX IF NOT EXISTS idx_failure_patterns_model ON failure_patterns(model)',
  'CREATE INDEX IF NOT EXISTS idx_escalations_request ON escalations(request_id)',
];
