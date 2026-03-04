# Memory System

The Memory System is Switch AI's learning database. It persists all request history, tracks model performance, and enables continuous improvement through data-driven decision making.

**Location**: `~/.switch-ai/memory.db` (SQLite)

---

## Overview

The memory system serves three purposes:

1. **Record Keeping** - Complete audit trail of all requests
2. **Performance Tracking** - Which models succeed/fail on which tasks
3. **Learning** - Improve future decision making based on history

```
New Request
    ↓
Decision Engine (queries memory)
    ↓
Request executed
    ↓
Response validated
    ↓
Events logged to SQLite
    ↓
Memory updated (success rates, blacklists, etc)
    ↓
Next request uses improved data
```

---

## Database Schema

### Table: `requests`

Core record of every API call made through Switch AI.

```sql
CREATE TABLE requests (
  -- Identification
  id TEXT PRIMARY KEY,              -- UUID
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Request details
  prompt TEXT NOT NULL,             -- Full user request
  tokens_input INTEGER,             -- Tokens in request
  tokens_output INTEGER,            -- Tokens in response
  tokens_total INTEGER,             -- Sum

  -- Analysis & selection
  prompt_hash TEXT,                 -- For deduplication
  complexity_score INTEGER,         -- 1-10
  category TEXT,                    -- documentation, tests, code, etc

  -- Model & routing
  initial_model TEXT NOT NULL,      -- First choice
  final_model TEXT NOT NULL,        -- Model actually used (may differ due to escalation)
  escalations INTEGER DEFAULT 0,    -- How many times escalated

  -- Result
  status TEXT NOT NULL,             -- success, failure, timeout, error
  response TEXT,                    -- Response content (optional, can be NULL for privacy)
  response_length INTEGER,          -- Length of response

  -- Quality
  validation_passed BOOLEAN,        -- Did response pass quality check?
  validation_notes TEXT,            -- Why it failed (if failed)

  -- Performance
  latency_ms INTEGER,               -- Total latency
  cost REAL,                        -- Cost in USD

  -- Metadata
  user_id TEXT,                     -- If multi-user
  project_path TEXT,                -- Project being worked on
  environment TEXT,                 -- dev, staging, prod
  metadata JSON                     -- Custom metadata
);

-- Indexes for fast queries
CREATE INDEX idx_requests_timestamp ON requests(timestamp);
CREATE INDEX idx_requests_category ON requests(category);
CREATE INDEX idx_requests_final_model ON requests(final_model);
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_user ON requests(user_id);
```

### Table: `model_performance`

Aggregated performance metrics per model per task category.

```sql
CREATE TABLE model_performance (
  -- Identification
  model TEXT NOT NULL,
  category TEXT NOT NULL,

  -- Statistics
  attempts INTEGER DEFAULT 0,       -- Total attempts
  successes INTEGER DEFAULT 0,      -- Successful attempts
  failures INTEGER DEFAULT 0,       -- Failed attempts
  timeouts INTEGER DEFAULT 0,       -- Timeout failures
  errors INTEGER DEFAULT 0,         -- Error failures

  -- Computed metrics
  success_rate REAL,                -- successes / attempts (0-1)
  failure_rate REAL,                -- failures / attempts (0-1)
  timeout_rate REAL,                -- timeouts / attempts (0-1)

  -- Performance metrics
  avg_latency_ms REAL,              -- Average latency
  min_latency_ms INTEGER,
  max_latency_ms INTEGER,
  avg_cost REAL,                    -- Average cost per request
  min_cost REAL,
  max_cost REAL,

  -- Time tracking
  first_used DATETIME,
  last_used DATETIME,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (model, category)
);

-- Index for fast filtering
CREATE INDEX idx_model_perf_success ON model_performance(success_rate DESC);
CREATE INDEX idx_model_perf_cost ON model_performance(avg_cost ASC);
```

### Table: `failure_patterns`

Tracks recurring failure patterns and auto-blacklisting logic.

```sql
CREATE TABLE failure_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Identification
  model TEXT NOT NULL,
  category TEXT NOT NULL,
  error_type TEXT NOT NULL,         -- truncation, timeout, syntax_error, etc

  -- Pattern details
  error_message TEXT,               -- First 500 chars of error
  example_prompt TEXT,              -- Example that triggered this

  -- Statistics
  count INTEGER DEFAULT 1,          -- How many times this happened
  consecutive_count INTEGER DEFAULT 1,  -- How many in a row

  -- Blacklist management
  is_active BOOLEAN DEFAULT TRUE,
  blacklist_until DATETIME,         -- Temp blacklist expires when
  blacklist_reason TEXT,            -- Why blacklisted (e.g., "5 consecutive failures")

  -- Timing
  first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (model, category) REFERENCES model_performance(model, category)
);

-- Indexes for blacklist queries
CREATE INDEX idx_failures_active ON failure_patterns(is_active, blacklist_until);
CREATE INDEX idx_failures_model ON failure_patterns(model, category);
```

### Table: `model_ratings`

Aggregate quality scores for quick access.

```sql
CREATE TABLE model_ratings (
  model TEXT PRIMARY KEY,

  -- Overall score (0-100)
  overall_score REAL,

  -- Category-specific scores (0-100)
  documentation_score REAL,
  tests_score REAL,
  simpleCode_score REAL,
  complexCode_score REAL,
  research_score REAL,
  refactoring_score REAL,
  architecture_score REAL,

  -- Meta
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  data_points INTEGER               -- How many requests contributed
);
```

### Table: `escalations`

Track escalation events for analysis.

```sql
CREATE TABLE escalations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  request_id TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,

  from_model TEXT NOT NULL,         -- Model that failed
  to_model TEXT NOT NULL,           -- Model that succeeded

  category TEXT,
  reason TEXT,                      -- Why escalated (validation failed, etc)

  FOREIGN KEY (request_id) REFERENCES requests(id)
);

CREATE INDEX idx_escalations_from ON escalations(from_model);
```

### Table: `cost_analysis`

Summary of costs by period for budget tracking.

```sql
CREATE TABLE cost_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  period TEXT,                      -- "2024-01", "2024-02", etc
  total_requests INTEGER,
  successful_requests INTEGER,
  failed_requests INTEGER,

  total_cost REAL,
  avg_cost_per_request REAL,

  -- Tier breakdown
  free_tier_requests INTEGER,
  free_tier_cost REAL,
  cheap_tier_requests INTEGER,
  cheap_tier_cost REAL,
  balanced_tier_requests INTEGER,
  balanced_tier_cost REAL,
  premium_tier_requests INTEGER,
  premium_tier_cost REAL,

  -- Top models
  top_model TEXT,
  top_model_requests INTEGER,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Key Queries

### 1. Success Rate by Model & Category

```sql
SELECT
  model,
  category,
  attempts,
  successes,
  ROUND((successes::float / NULLIF(attempts, 0)) * 100, 2) as success_rate
FROM model_performance
WHERE category = 'documentation'
ORDER BY success_rate DESC;

-- Result:
-- claude-opus, documentation, 245, 243, 99.18
-- claude-sonnet, documentation, 312, 293, 93.91
-- claude-haiku, documentation, 458, 448, 97.82
```

### 2. Find Blacklisted Models

```sql
SELECT DISTINCT model
FROM failure_patterns
WHERE is_active = TRUE
  AND blacklist_until > NOW();

-- Models currently blacklisted:
-- deepseek
-- ollama-mistral
```

### 3. Cost Effectiveness

```sql
SELECT
  model,
  category,
  ROUND(avg_cost, 6) as avg_cost,
  ROUND(success_rate, 3) as success_rate,
  ROUND(avg_cost / (success_rate + 0.1), 6) as cost_per_success
FROM model_performance
WHERE category = 'code'
ORDER BY cost_per_success ASC;

-- Best bang for buck:
-- haiku, code, 0.001200, 0.94, 0.001277
-- deepseek, code, 0.000800, 0.90, 0.000889
-- sonnet, code, 0.015000, 0.96, 0.015625
```

### 4. Recent Request History

```sql
SELECT
  timestamp,
  category,
  initial_model,
  final_model,
  status,
  cost,
  CASE WHEN escalations > 0 THEN 'YES' ELSE 'NO' END as escalated
FROM requests
ORDER BY timestamp DESC
LIMIT 50;
```

### 5. Escalation Analysis

```sql
SELECT
  from_model,
  to_model,
  COUNT(*) as escalation_count,
  category
FROM escalations
GROUP BY from_model, to_model, category
ORDER BY escalation_count DESC;

-- Which models are escalated most?
-- haiku, sonnet, 15, code
-- deepseek, sonnet, 12, code
-- sonnet, opus, 8, architecture
```

### 6. Problem Models

```sql
SELECT
  model,
  category,
  COUNT(*) as failure_count,
  blacklist_until
FROM failure_patterns
WHERE is_active = TRUE
GROUP BY model, category
ORDER BY failure_count DESC;
```

---

## Learning & Improvement Loop

### Data Collection

Every request triggers these events:

```
REQUEST
  ├─ Timestamp
  ├─ Request content
  ├─ Complexity analysis
  └─ Model selected

EXECUTION
  ├─ Model called
  ├─ Response received
  ├─ Latency measured
  └─ Cost calculated

VALIDATION
  ├─ Quality checks
  ├─ Validation result
  ├─ If failed: escalation
  └─ Final model recorded

LOGGING
  ├─ INSERT into requests table
  ├─ UPDATE model_performance table
  ├─ If failed: INSERT into failure_patterns
  ├─ If escalated: INSERT into escalations
  └─ UPDATE model_ratings table
```

### Performance Tracking

After each request, the `model_performance` table is updated:

```typescript
// Pseudocode for updating performance
function updateModelPerformance(model: string, category: string, result: 'success' | 'failure') {
  const row = db.query(
    `SELECT * FROM model_performance WHERE model = ? AND category = ?`,
    [model, category]
  );

  const updates = {
    attempts: row.attempts + 1,
    successes: result === 'success' ? row.successes + 1 : row.successes,
    failures: result === 'failure' ? row.failures + 1 : row.failures,
    last_used: new Date(),
  };

  // Recompute derived metrics
  updates.success_rate = updates.successes / updates.attempts;
  updates.failure_rate = updates.failures / updates.attempts;

  db.update(updates);
}
```

### Blacklisting Logic

When a model fails repeatedly, it's temporarily blacklisted:

```typescript
function checkAndUpdateBlacklist(model: string, category: string) {
  const failures = db.query(
    `SELECT * FROM failure_patterns
     WHERE model = ? AND category = ? AND is_active = TRUE`,
    [model, category]
  );

  // If 5 consecutive failures on this category
  if (failures.consecutive_count >= 5) {
    db.update(
      `UPDATE failure_patterns SET
        blacklist_until = NOW() + INTERVAL 1 HOUR,
        blacklist_reason = '5 consecutive failures'
      WHERE model = ? AND category = ?`,
      [model, category]
    );
  }

  // If success rate drops below 30% on this category
  const perf = db.query(
    `SELECT success_rate FROM model_performance
     WHERE model = ? AND category = ?`,
    [model, category]
  );

  if (perf.success_rate < 0.3) {
    db.update(
      `UPDATE failure_patterns SET
        blacklist_until = NOW() + INTERVAL 1 DAY,
        blacklist_reason = 'Low success rate'
      WHERE model = ? AND category = ?`,
      [model, category]
    );
  }
}
```

### Auto-Recovery

Blacklists are temporary. If a model starts succeeding again, it's removed from blacklist:

```typescript
function updateBlacklistStatus(model: string, category: string, result: 'success' | 'failure') {
  if (result === 'success') {
    // Consecutive failure count resets
    db.update(
      `UPDATE failure_patterns SET consecutive_count = 0
       WHERE model = ? AND category = ?`,
      [model, category]
    );

    // If success rate improves above 70%, whitelist
    const perf = db.query(
      `SELECT success_rate FROM model_performance
       WHERE model = ? AND category = ?`,
      [model, category]
    );

    if (perf.success_rate > 0.7) {
      db.update(
        `UPDATE failure_patterns SET is_active = FALSE
         WHERE model = ? AND category = ?`,
        [model, category]
      );
    }
  } else {
    // Increment consecutive failure count
    db.update(
      `UPDATE failure_patterns SET consecutive_count = consecutive_count + 1
       WHERE model = ? AND category = ?`,
      [model, category]
    );
  }
}
```

---

## Data Retention & Cleanup

### Retention Policy

- **Default**: Keep 90 days of history
- **Configurable**: Via `~/.switch-ai/config.json`

```json
{
  "memory": {
    "retentionDays": 90,
    "maxDatabaseSize": "1GB",
    "autoVacuum": true,
    "autoVacuumInterval": "weekly"
  }
}
```

### Cleanup Operations

```sql
-- Delete old requests (older than 90 days)
DELETE FROM requests
WHERE timestamp < datetime('now', '-90 days');

-- Cleanup orphaned failure patterns
DELETE FROM failure_patterns
WHERE model NOT IN (SELECT DISTINCT model FROM model_performance);

-- Rebuild indexes (optimize performance)
VACUUM;
REINDEX;
```

**Automatic cleanup runs**:
- Weekly by default
- Can be triggered manually: `switch-ai maintenance --cleanup`

---

## Privacy Considerations

By default, Switch AI stores:
- ✓ Request metadata (timestamp, complexity, model, cost)
- ✓ Response length (for analytics)
- ✗ Actual request text (can be disabled)
- ✗ Actual response content (privacy-first default)

**To store request/response content** (for debugging):

```bash
switch-ai config set memory.storeContent true
```

**To disable request/response storage**:

```bash
switch-ai config set memory.storeContent false
```

---

## Monitoring & Dashboards

### CLI Queries

```bash
# View cost by period
switch-ai history --summary --period month

# Top models by requests
switch-ai history --group-by model --limit 10

# Escalation rate
switch-ai history --escalations-only --summary

# Model success rate
switch-ai models --with-stats

# Blacklisted models
switch-ai models --blacklisted
```

### SQL Queries

For power users, direct SQLite queries:

```bash
# Open SQLite shell
sqlite3 ~/.switch-ai/memory.db

# List all tables
.tables

# View requests from today
SELECT * FROM requests WHERE DATE(timestamp) = DATE('now');

# Top categories by cost
SELECT category, COUNT(*) as count, SUM(cost) as total_cost
FROM requests
GROUP BY category
ORDER BY total_cost DESC;
```

---

## Expansion & Scaling

### Single Machine

Default setup: SQLite on local disk
- File size: < 1 GB for 10,000+ requests
- Performance: Fast (queries <100ms)
- Capacity: Sufficient for solo dev or small team

### Small Team (Shared Database)

Use SQLite with shared NFS:
```
Server: NFS mount at /mnt/shared/memory.db
Team machines: All read/write to NFS
Locking: SQLite handles with WAL mode
```

### Enterprise (Large Scale)

Migrate to PostgreSQL:

```bash
switch-ai migrate --target postgres --connection-string "postgres://..."
```

Schema supports migration without changes.

---

## API for Direct Access

For advanced integrations:

```typescript
import { MemorySystem } from 'switch-ai/memory';

const memory = new MemorySystem();

// Query performance
const perf = memory.getModelPerformance('haiku', 'documentation');
// Returns: { successes: 100, attempts: 102, success_rate: 0.98, ... }

// Check if model is blacklisted
const isBlacklisted = memory.isModelBlacklisted('deepseek', 'code');
// Returns: false

// Get escalation history
const escalations = memory.getEscalations({
  model: 'sonnet',
  category: 'code',
  limit: 50
});

// Log custom event
memory.logRequest({
  prompt: "...",
  complexity: 5,
  category: "code",
  model: "haiku",
  status: "success",
  cost: 0.001
});
```

---

## Troubleshooting

### Memory database corrupted

```bash
# Reset memory (delete all data)
switch-ai reset-memory --confirm

# Or backup first
switch-ai memory export > memory_backup.json
switch-ai reset-memory --confirm
```

### Database too large

```bash
# Check size
du -sh ~/.switch-ai/memory.db

# Cleanup old data
switch-ai maintenance --cleanup --older-than 180  # Delete > 6 months old

# Vacuum and optimize
switch-ai maintenance --optimize
```

### Slow queries

```bash
# Analyze performance
switch-ai maintenance --analyze

# Rebuild indexes
switch-ai maintenance --reindex
```
