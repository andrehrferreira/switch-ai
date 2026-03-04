# System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                       CLIENT LAYER                              │
│  (Claude SDK, curl, TypeScript, Python, etc.)                  │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP/JSON (ANTHROPIC API compatible)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SWITCH AI PROXY SERVER                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Middleware Stack                                            │ │
│  │ • Request parser (ANTHROPIC API v1)                       │ │
│  │ • API key validation                                       │ │
│  │ • Rate limiting (optional)                                │ │
│  │ • Response formatter                                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                         ▼                                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ DECISION ENGINE                                             │ │
│  │ • Complexity Analyzer                                      │ │
│  │ • Capability Scanner                                       │ │
│  │ • Model Registry                                           │ │
│  │ • Selection Algorithm                                      │ │
│  │ • Learning System (SQLite queries)                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                         ▼                                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ROUTER                                                      │ │
│  │ • LiteLLM Manager                                          │ │
│  │ • Claude Code CLI Executor                                 │ │
│  │ • Gemini CLI Executor                                      │ │
│  │ • Ollama Manager                                           │ │
│  │ • Fallback Logic                                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                         ▼                                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ VALIDATOR                                                   │ │
│  │ • Response Quality Check                                   │ │
│  │ • Completeness Heuristics                                  │ │
│  │ • Known Failure Patterns                                   │ │
│  │ • Escalation Trigger                                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                         ▼                                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ MEMORY SYSTEM                                               │ │
│  │ • SQLite Database Writer                                   │ │
│  │ • Event Logging                                            │ │
│  │ • Performance Tracking                                     │ │
│  │ • Model Rating Updates                                     │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
       ▼                    ▼                    ▼
   LiteLLM         Claude Code CLI         Gemini CLI
   (OpenRouter)    (localhost)             (localhost)
      │                 │                      │
      ▼                 ▼                      ▼
   [Models]         [Models]             [Models]
   Haiku            Opus                 Gemini 2.0
   Sonnet           Opus Max             Flash
   Deepseek         Sonnet               Pro
   ...              ...                  ...
```

---

## Component Details

### 1. Proxy Server (Port 4000)

**Responsibility**: Accept HTTP requests compatible with ANTHROPIC API v1, forward to Decision Engine, receive response, return to client.

**Key Technologies**:
- Node.js HTTP server (built-in `http` module or Express for simplicity)
- Request/response parsing with JSON validation (Zod)
- Middleware chain pattern

**Interface**:
```typescript
POST /v1/messages
Content-Type: application/json

{
  "model": "auto",  // Special value: auto-select
  "messages": [...],
  "max_tokens": 1024,
  ...
}
```

**Key Features**:
- ✓ Fully compatible with ANTHROPIC SDK
- ✓ Validates incoming requests
- ✓ Forwards response unchanged
- ✓ Logs all interactions
- ✓ Handles streaming responses

---

### 2. Decision Engine

**Responsibility**: Analyze incoming request, determine best model, return model name + reasoning.

**Components**:

#### 2a. Complexity Analyzer
- Analyzes prompt text for keywords/patterns
- Optional: analyzes project context (file types, imports, dependencies)
- Outputs complexity score (1-10) and category
- Categories: documentation, tests, simple-code, complex-code, research, refactor, architecture

**Algorithm** (Simplified):
```
score = base_score (from category)
score += keyword_boost (complexity words found)
score -= familiarity_factor (common patterns)
score = clamp(1, 10)
```

#### 2b. Capability Scanner
- Checks for installed tools: `which claude`, `which gemini`, `which ollama`
- Reads environment variables for API keys
- Queries Claude Code CLI for remaining credits
- Returns: list of available providers + their current quota

**Refresh Rate**: Every 5 minutes (cached)

#### 2c. Model Registry
- Static registry of 20+ models organized by tier
- Dynamic pricing from OpenRouter API (1h cache)
- Fallback chain: if primary model unavailable, next in tier
- Metadata: name, tier, cost/token, context window, specialized capabilities

**Data Structure**:
```typescript
interface Model {
  id: string;           // "claude-haiku"
  name: string;         // "Claude Haiku"
  tier: "free" | "cheap" | "balanced" | "premium";
  provider: "anthropic" | "openrouter" | "local" | "gemini";
  costPer1kTokens: number;
  contextWindow: number;
  categories: string[]; // ["documentation", "tests", "code"]
  blacklistedUntil?: Date;
  successRate: number;  // 0-1, from memory
}
```

#### 2d. Selection Algorithm
**Input**:
- Request analysis (complexity score, category)
- Available models
- User preferences
- Historical performance data

**Output**:
- Selected model name
- Confidence score
- Reasoning (why this model)

**Logic** (Pseudocode):
```
1. Filter models by: availability + tier_matches_complexity
2. Filter by: user constraints (max cost, preferred models)
3. Sort by: (success_rate DESC, cost ASC, preference ASC)
4. Select: first model in sorted list
5. Return: model, confidence, reason
```

**Decision Tree** (Examples):
```
IF complexity = 1-3 (documentation):
  PREFER: Free tier (Claude Code, Gemini CLI)
  FALLBACK: Haiku

ELSE IF complexity = 4-6 (feature code):
  PREFER: Balanced tier (Sonnet)
  FALLBACK: Opus (if critical), or Haiku (if budget)

ELSE IF complexity = 7-10 (architecture):
  PREFER: Premium tier (Opus)
  FALLBACK: Sonnet (if budget)

IF failed_before_on_category:
  SKIP that model
  MOVE to next

IF total_cost_exceeded:
  USE cheapest viable option
```

---

### 3. Router

**Responsibility**: Send request to selected model backend, handle responses/errors.

**Backends Supported**:

#### 3a. LiteLLM (OpenRouter proxy)
- LiteLLM running on localhost:8000 (configurable)
- Routes to OpenRouter, which has 100+ models
- Protocol: ANTHROPIC API v1 compatible
- Handles: retries, rate limiting, cost calculation

**Flow**:
```
Router → LiteLLM → OpenRouter → Model API
                   (Haiku, Deepseek, etc.)
```

#### 3b. Claude Code CLI
- Executes: `claude --model opus/sonnet/haiku --input <file>`
- Input/output via stdin/stdout or temp files
- Parses response from Claude Code
- Handles: credential management, quota checks

#### 3c. Gemini CLI
- Executes: `gemini prompt "<text>"` or via API
- Handles: free tier vs. paid API
- Parses response

#### 3d. Ollama (Local)
- HTTP endpoint: localhost:11434
- Models: locally downloaded (llama2, mistral, etc.)
- Zero cost, privacy-first
- Slower than cloud APIs

**Response Handling**:
```typescript
interface RoutingResult {
  model: string;
  status: "success" | "error" | "timeout";
  content: string;
  cost: number;
  latency: number;
  error?: Error;
}
```

**Fallback Chain**:
If selected model fails:
1. Retry with backoff (up to N times)
2. Escalate to next-best model
3. Log failure to memory
4. Return result or error

---

### 4. Validator

**Responsibility**: Check response quality, decide if escalation needed.

**Checks**:

1. **Completeness**
   - Response not empty
   - No truncation indicators (e.g., "Assistant: [CONTINUED]")
   - Reasonable length for task

2. **Code Quality** (if task involves code)
   - Syntax check: Can code compile/parse?
   - Logical check: Does code make sense?
   - Heuristic: Functions are complete, imports are valid

3. **Known Failures**
   - Check if response matches known bad patterns
   - Example: "I apologize, I cannot..." for code generation
   - Example: Incomplete JSON responses
   - Example: Repeated same sentence 3+ times

4. **Custom Validators** (extensible)
   - Per-category validation rules
   - User-provided validators

**Output**:
```typescript
interface ValidationResult {
  isValid: boolean;
  confidence: number;  // 0-1
  issues: string[];
  shouldEscalate: boolean;
  suggestedModel?: string;
}
```

**Escalation Logic**:
- If validation fails AND escalation retries remaining
- Select next-best model (from Decision Engine)
- Retry request with that model
- Log escalation event

---

### 5. Memory System (SQLite)

**Responsibility**: Store all request history, enable learning.

**Location**: `~/.switch-ai/memory.db` (local, persistent)

**Schema** (Simplified):

```sql
-- Core events
CREATE TABLE requests (
  id TEXT PRIMARY KEY,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  prompt TEXT,
  complexity_score INTEGER,
  category TEXT,
  selected_model TEXT,
  final_model TEXT,  -- May differ due to escalation
  status TEXT,  -- success, failure, escalated
  cost REAL,
  latency_ms INTEGER,
  validation_passed BOOLEAN,
  escalations INTEGER,
  tokens_used INTEGER
);

-- Model performance tracking
CREATE TABLE model_performance (
  model TEXT,
  category TEXT,
  attempts INTEGER,
  successes INTEGER,
  failures INTEGER,
  avg_latency_ms REAL,
  avg_cost REAL,
  last_used DATETIME,
  success_rate REAL,  -- Computed
  PRIMARY KEY (model, category)
);

-- Failure patterns (for blacklisting)
CREATE TABLE failure_patterns (
  id INTEGER PRIMARY KEY,
  model TEXT,
  category TEXT,
  error_type TEXT,
  count INTEGER,
  first_seen DATETIME,
  last_seen DATETIME,
  blacklist_until DATETIME
);

-- Model ratings (aggregate scores)
CREATE TABLE model_ratings (
  model TEXT PRIMARY KEY,
  overall_score REAL,  -- 0-100
  documentation_score REAL,
  tests_score REAL,
  code_score REAL,
  complex_score REAL,
  last_updated DATETIME
);
```

**Queries Used by Decision Engine**:
```sql
-- Get success rate for model + category
SELECT success_rate FROM model_performance
WHERE model = ? AND category = ?;

-- Find blacklisted models
SELECT model FROM failure_patterns
WHERE blacklist_until > NOW()
GROUP BY model;

-- Get cost-effectiveness
SELECT model, avg_cost, success_rate
FROM model_performance
WHERE category = ?
ORDER BY (avg_cost * (1 - success_rate)) ASC;  -- Cost + quality
```

**Cleanup**:
- Retention policy: Delete records older than N days (default: 90)
- Vacuum database monthly
- Auto-archiving for large datasets

---

## Data Flow Examples

### Example 1: Simple Documentation Task

```
User Request:
├─ "Write a README for my Node.js project"
│
├─ Complexity Analysis
│  ├─ Keywords: "README", "write", "documentation"
│  ├─ Score: 2/10 (very simple)
│  └─ Category: "documentation"
│
├─ Capability Check
│  ├─ Claude Code available? YES (10 credits remaining)
│  ├─ API keys: OpenRouter (yes), Gemini (no)
│  └─ Local models: Ollama not available
│
├─ Decision Engine
│  ├─ Query: SELECT * FROM model_ratings WHERE documentation_score DESC
│  ├─ Available: [Claude Code, Haiku, Gemini Flash]
│  ├─ Decision: Use "Claude Code Haiku" (free tier, high success on docs)
│  └─ Confidence: 95%
│
├─ Route: Claude Code CLI
│  └─ $ claude --model haiku --input prompt.txt
│
├─ Validation
│  ├─ Length: OK (reasonable size)
│  ├─ Completeness: OK (not truncated)
│  └─ Passed: YES
│
├─ Memory Log
│  ├─ INSERT requests (documentation, haiku, success)
│  └─ UPDATE model_performance (haiku +1 success)
│
└─ Response: README content returned to user
   └─ Cost: $0.00 (Claude Code credit)
```

### Example 2: Complex Feature with Escalation

```
User Request:
├─ "Implement distributed cache with Redis cluster failover"
│
├─ Complexity Analysis
│  ├─ Keywords: "distributed", "cluster", "failover", "complex"
│  ├─ Project context: Microservices architecture detected
│  ├─ Score: 9/10 (very complex)
│  └─ Category: "complex-code"
│
├─ Decision Engine
│  ├─ Check history: "complex-code" success rates
│  │  ├─ Haiku: 10% success (blacklisted from prev failures)
│  │  ├─ Sonnet: 80% success
│  │  ├─ Opus: 98% success
│  ├─ Available: [Claude Code Opus (3 credits), OpenRouter Sonnet]
│  ├─ Cost analysis: Opus $0.15 vs Sonnet $0.02
│  ├─ Decision: Try "Sonnet" first (good balance)
│  └─ Confidence: 75%
│
├─ Route: LiteLLM → OpenRouter → Sonnet
│  └─ Response received, length ~2000 tokens
│
├─ Validation
│  ├─ Completeness: FAILED (looks truncated, logic incomplete)
│  ├─ Code syntax check: FAILED (imports missing)
│  └─ Escalate: YES (trigger retry)
│
├─ Escalation (Retry #1)
│  ├─ Decision: Use "Opus" (better for complex tasks)
│  ├─ Route: Claude Code CLI Opus
│  ├─ Response: Complete, valid solution
│  └─ Validation: PASSED
│
├─ Memory Log
│  ├─ INSERT requests (complex-code, sonnet, escalated)
│  ├─ INSERT requests (complex-code, opus, success, escalation=1)
│  ├─ UPDATE model_performance (sonnet -1, opus +1)
│  ├─ INSERT failure_patterns (sonnet, complex-code, truncation)
│  └─ Cost tracked: $0.15 (Opus used)
│
└─ Response: Implementation code returned to user
   └─ Cost: ~$0.15 (Claude Code credit used)
```

---

## Technology Stack Justification

| Component | Technology | Why? |
|-----------|-----------|------|
| Runtime | Node.js 18+ | Cross-platform, excellent async I/O |
| Language | TypeScript | Type safety, better than JS for routing logic |
| Database | SQLite | Local, no dependencies, sufficient for use case |
| HTTP | Node built-in + Zod | Lightweight, no unnecessary deps |
| CLI | Commander.js | Standard, good DX |
| Process Management | Native PM2 optional | Auto-restart, monitoring |
| Testing | Vitest | Fast, modern, ESM native |

---

## Deployment Architectures

### Architecture 1: Local Development
```
Developer Machine
├─ Switch AI (localhost:4000)
├─ OpenRouter API key
└─ Claude SDK pointing to localhost:4000
```
**Best for**: Solo developers, freelancers
**Complexity**: Low

### Architecture 2: Small Team (Shared Proxy)
```
Team Network
├─ Switch AI Server (192.168.1.100:4000)
├─ Dev 1 → Switch AI
├─ Dev 2 → Switch AI
├─ Dev 3 → Switch AI
└─ SQLite memory on shared NFS (optional audit)
```
**Best for**: 3-5 person teams
**Complexity**: Medium (network setup)
**Requires**: Fixed IP or DNS for server

### Architecture 3: Enterprise
```
Cloud Deployment
├─ Switch AI (Kubernetes, multiple replicas)
├─ Shared SQLite (or PostgreSQL) for memory
├─ OpenRouter API key (team managed)
├─ Audit logging to central system
└─ Usage dashboard for management
```
**Best for**: Large organizations
**Complexity**: High (DevOps required)
**Requires**: K8s, central logging, etc.

---

## Security Considerations

**API Key Management**:
- Keys only in environment variables
- Never logged (stripped in middleware)
- Sanitized in error messages

**Request/Response Privacy**:
- Local SQLite: request content not stored (only metadata)
- Option for encrypted database
- HTTPS support for remote setups

**Rate Limiting**:
- Per-IP or per-key limits (configurable)
- Prevent abuse of expensive models
- Quota enforcement

**Audit Trail**:
- All requests logged with: timestamp, user, model, cost
- Enables accountability in team settings

---

## Performance Optimization

**Decision Latency** (Target: <500ms):
- Cache complexity scores (1h)
- Cache OpenRouter prices (1h)
- Local SQLite queries (~10ms)
- Model selection algorithm optimized (O(n) where n=20 models)

**Memory Usage** (Target: <100MB):
- Streaming responses (don't buffer large outputs)
- Connection pooling for LiteLLM
- Cleanup old memory records

**Throughput**:
- Single Node.js process handles 10+ concurrent requests
- Horizontal scaling: multiple instances + load balancer
- Database sharding for very large deployments

---

## Extensibility Points

**Custom Complexity Analyzers**:
```typescript
interface ComplexityAnalyzer {
  analyze(request: Request): { score: number; category: string };
}
```

**Custom Validators**:
```typescript
interface ResponseValidator {
  validate(response: Response): ValidationResult;
}
```

**Custom Model Backends**:
```typescript
interface ModelBackend {
  route(request: Request): Promise<Response>;
}
```

**Custom Decision Algorithms**:
- Pluggable selection logic
- A/B testing support
- User-defined routing rules

---

## Monitoring & Observability

**Metrics**:
- Request count by model
- Cost per model/category
- Escalation rate
- Model success rates

**Logging**:
- Structured JSON logging
- Log levels: debug, info, warn, error
- Optional StatsD export

**Health Checks**:
- `/health` endpoint returns status
- All backends reachable? Response time?
- Database size and performance

**Alerts** (for Production):
- High escalation rate (>30%)
- Model availability down
- Database size growing too fast
- Unusual cost spike
