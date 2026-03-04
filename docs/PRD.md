# Product Requirements Document (PRD)

## Executive Summary

Switch AI is an intelligent model routing system that automatically selects the most cost-effective and capable AI model for any given task. It acts as a central proxy between the user and multiple AI backends, making real-time decisions based on task complexity, model availability, cost, and historical performance.

**Vision**: Enable developers and teams to maximize their AI model investments by intelligently allocating expensive compute resources to complex tasks while using cheap/free models for routine work.

---

## 1. Problem Statement

### Current State
- Users have access to multiple AI models: Claude (various tiers), Gemini, Deepseek, local models (Ollama)
- Each model has different capabilities and costs
- Manual selection process: Users must decide which model to use for each task
- **Result**: Inefficient allocation - expensive models waste tokens on simple tasks (docs, tests)

### Pain Points
1. **Cost Inefficiency**: Wasting expensive Claude Opus quota on documentation ($0.30 when Haiku would cost $0.003)
2. **Manual Switching**: Constantly changing `ANTHROPIC_BASE_URL` between different providers
3. **No Learning**: When a cheap model fails, users forget and retry with same model
4. **Subscription Waste**: Team Claude Code subscriptions depleted quickly, forcing costly upgrades
5. **Underutilization**: Local models (Ollama) and cheap alternatives sit unused

### Impact
- 💰 **Cost**: 50-80% of token budget wasted on suboptimal model selection
- ⏱️ **Time**: Minutes spent daily switching between different API endpoints
- 📊 **Performance**: No systematic way to improve model routing decisions
- 👥 **Team Dynamics**: Unclear who burned through credits, no fair distribution

---

## 2. Solution Overview

Switch AI is a **decision engine + proxy server** that:

```
Request → Analyze → Decide → Route → Validate → Learn → Response
```

### Core Capabilities

**1. Intelligent Routing**
- Analyzes request complexity (documentation, tests, code, architecture)
- Checks available models and credits
- Queries real-time pricing from OpenRouter
- Selects optimal model from 20+ options

**2. Central Proxy**
- Single `ANTHROPIC_BASE_URL` endpoint
- Compatible with any existing ANTHROPIC client
- No code changes needed to adopt Switch AI

**3. Learning System**
- SQLite database of all requests and outcomes
- Tracks model performance by task category
- Auto-blacklist models that fail consistently
- Improves routing decisions over time

**4. Validation & Escalation**
- Quality checks on responses
- Automatic escalation if validation fails
- Graceful fallback to better models

**5. Capability Detection**
- Auto-discovers installed tools (Claude Code, Gemini CLI, Ollama)
- Monitors API key availability
- Checks credit/quota status

---

## 3. Personas & Use Cases

### Persona 1: Freelance Developer
**Profile**: Solo dev, limited budget, uses Claude for various tasks

**Problems**:
- Burning through Opus quota on boilerplate code
- Can't afford to upgrade to higher tiers
- Hours wasted manually switching between models

**With Switch AI**:
- Haiku auto-selected for documentation → 100x cheaper
- Sonnet auto-selected for feature coding → good balance
- Opus preserved for architecture decisions
- **Result**: 60-80% cost reduction, same or better output quality

### Persona 2: Small Team (3-5 devs)
**Profile**: Startup with shared Claude Code subscription

**Problems**:
- One developer burning through credits fast
- No visibility into who used what
- Forced to upgrade subscription frequently
- Conflicts over "whose task got priority"

**With Switch AI**:
- Centralized proxy routes all requests
- Every request logged with user/cost/model
- Fair distribution: simple tasks use cheap models
- Complex work gets quality tools
- **Result**: 3-5x longer subscription lifespan, better team dynamics

### Persona 3: Academic Program
**Profile**: Teaching programming with budget constraints

**Problems**:
- Can't afford premium models for 100s of students
- Students waste tokens on redundant prompts
- No way to grade/review AI interactions
- Limited learning opportunities

**With Switch AI**:
- Most student tasks routed to Haiku (~$0.001 each)
- Complex assignments get Sonnet (~$0.01 each)
- Complete audit trail for educators
- **Result**: 10x cost reduction, transparency, better teaching tool

---

## 4. Functional Requirements

### Core Features

**FR1: Complexity Analysis**
- Analyze incoming request (prompt + optional project context)
- Classify into 7 categories: documentation, tests, simple-code, complex-code, research, refactor, architecture
- Assign complexity score (1-10)

**FR2: Capability Detection**
- Auto-detect installed tools: Claude Code, Gemini CLI, Cursor, Ollama
- Check for API keys in environment
- Monitor credit status (for Claude Code)
- Update availability every 5 minutes

**FR3: Model Selection**
- Maintain registry of 20+ models across 5+ tiers
- Filter by: availability, cost, task complexity match
- Apply constraints: max cost per request, preferred models
- Return ranked list of candidates

**FR4: Request Routing**
- Accept requests compatible with ANTHROPIC API
- Route to: LiteLLM (for OpenRouter), Claude Code CLI, Gemini CLI, Ollama
- Proxy response back to client
- Track latency and cost

**FR5: Response Validation**
- Check for truncation (incomplete responses)
- Verify code compiles (if applicable)
- Detect common failure patterns
- If validation fails → escalate to better model

**FR6: Learning System**
- SQLite database storing: request, selected model, cost, success/failure, latency
- Query: model performance by task category
- Identify problem patterns
- Auto-blacklist models with <50% success on category
- Whitelist improvements when models improve

**FR7: CLI Interface**
- `switch-ai start` - Start proxy server
- `switch-ai stop` - Stop server
- `switch-ai status` - Check status
- `switch-ai models` - List available models
- `switch-ai config` - View/edit configuration
- `switch-ai history` - Query request history
- `switch-ai reset-memory` - Clear learning database

**FR8: Configuration**
- Environment variables for all settings
- JSON config file at `~/.switch-ai/config.json`
- Programmatic API for advanced users
- Validation and schema enforcement (Zod)

---

## 5. Non-Functional Requirements

**NFR1: Performance**
- Decision latency < 500ms per request
- Proxy overhead < 100ms (excluding model latency)
- Memory footprint < 100MB
- SQLite database < 1GB (for 10k+ request history)

**NFR2: Reliability**
- 99%+ uptime when models are available
- Graceful degradation if a backend goes down
- Automatic retry with exponential backoff
- Connection pooling for LiteLLM

**NFR3: Scalability**
- Support 10+ simultaneous requests
- SQLite sharding for large deployments
- Batch request optimization
- Minimal CPU usage (single Node.js process)

**NFR4: Security**
- Local-first: memory database never leaves computer
- API keys stored securely (environment, no logs)
- HTTPS support for remote setups
- No telemetry or external tracking
- Optional audit logging

**NFR5: Observability**
- Structured logging (JSON format)
- Metrics: request count, cost, latency by model
- Debug mode with verbose output
- Optional StatsD export for monitoring

**NFR6: Maintainability**
- TypeScript for type safety
- <40 line functions
- 80%+ code coverage with Vitest
- Clear separation of concerns
- Comprehensive documentation

---

## 6. Model Tier Definitions

Switch AI organizes available models into tiers:

| Tier | Cost/Request | Models | Use Case |
|------|--------------|--------|----------|
| **Free** | $0 | Claude Code CLI, Gemini CLI (free), Ollama | Docs, tests, boilerplate |
| **Cheap** | $0.001-0.003 | Haiku, Deepseek Chat, Gemini 2.0 Flash | Tests, simple code, fixes |
| **Balanced** | $0.01-0.03 | Sonnet, Claude 3.5 Sonnet | Features, research, refactoring |
| **Premium** | $0.05-0.30 | Opus, Claude 4.6 | Architecture, complex logic, critical |

See [MODEL-TIERS.md](MODEL-TIERS.md) for detailed breakdown.

---

## 7. Decision Algorithm

High-level flowchart:

```
Input: User request
  ↓
[Analyze Complexity] → Score (1-10)
  ↓
[Check Availability]
  ├─ Available Claude Code credit?
  ├─ Available API keys?
  └─ Available local models?
  ↓
[Filter by Tier] → Matches complexity score
  ↓
[Check Historical Performance] → SQLite lookups
  ├─ Success rate for this task category?
  ├─ Any known failures?
  └─ Blacklisted models?
  ↓
[Query OpenRouter Prices] → Current pricing
  ↓
[Rank Candidates]
  ├─ Preference: free > cheap > balanced > premium
  ├─ Constraint: max cost per request
  ├─ Constraint: user model preferences
  └─ Ranking: best match for complexity
  ↓
[Select Top Model]
  ↓
Output: Selected model + reason
```

Full details: [DECISION-ENGINE.md](DECISION-ENGINE.md)

---

## 8. Learning & Improvement

### Feedback Loop

1. **Request Made**: User sends task through Switch AI
2. **Model Selected**: Decision engine picks model based on above algorithm
3. **Response Generated**: Model returns result
4. **Validation**: Quality checks run on response
5. **Logging**: All data saved to SQLite
6. **Improvement**: Next decision uses this data

### Learning Examples

**Scenario 1: Haiku Success**
```
Request: "Write a GET endpoint in Express"
Selected: Haiku (cheap tier, documentation category)
Result: ✅ High quality, complete solution
Logged: Haiku success rate ↑ for coding category
Impact: More code tasks routed to Haiku in future
```

**Scenario 2: Deepseek Failure**
```
Request: "Implement OAuth2 flow with complex token refresh"
Selected: Deepseek (cheap tier, initially thought medium-complex)
Result: ❌ Response truncated, logic incomplete
Escalated: Auto-retry with Sonnet → ✅ Success
Logged: Deepseek failure on complex-code + Sonnet recovery
Impact: Future complex-code tasks prefer Sonnet over Deepseek
```

**Scenario 3: Credit Optimization**
```
Request: "Refactor React component to use hooks"
Available Credit: Claude Code Opus (limited, 10 requests remaining)
Complexity: Medium-high (refactoring)
Selected: Sonnet (balanced tier)
Reason: Haiku likely to fail (from history), Opus reserved for critical work
Result: ✅ Sonnet handles well, preserves Opus credit
Logged: Smart credit preservation
Impact: Team stays productive longer without upgrading
```

---

## 9. User Journey

### Installation

```bash
npm install -g switch-ai
switch-ai start
# Server running on localhost:4000
```

### First-Time Setup

1. User sets `ANTHROPIC_BASE_URL=http://localhost:4000`
2. Existing ANTHROPIC client code works unchanged
3. First request analyzed and routed
4. SQLite database created at `~/.switch-ai/memory.db`
5. Learning begins immediately

### Daily Usage

1. **Morning**: Check status and available credits
   ```bash
   switch-ai status
   ```

2. **Work**: Use AI normally, Switch AI routes in background
   ```javascript
   const client = new Anthropic({
     baseURL: "http://localhost:4000/v1"
   });
   // Requests now auto-routed!
   ```

3. **Week End**: Review cost savings
   ```bash
   switch-ai history --limit 100 --summary
   # Shows: 50 requests, $0.45 total cost
   # Without Switch AI: $15.00 total cost
   # Savings: 97%
   ```

---

## 10. Success Metrics

### KPI 1: Cost Reduction
- **Baseline**: Average cost per request without Switch AI
- **Target**: Reduce by 60% (v1.0: 80%)
- **Measurement**: Compare `actual_cost` vs `opus_equivalent_cost` in SQLite

### KPI 2: Model Utilization
- **Target**: <5% of requests escalate to more expensive model
- **Measurement**: Count escalations / total requests

### KPI 3: Learning Quality
- **Target**: Model prediction accuracy improves 10% per month
- **Measurement**: Track false negatives (cheap model failed when shouldn't)

### KPI 4: User Adoption
- **Target**: v0.1: 50 GitHub stars, v1.0: 1000+ active installations
- **Measurement**: Download stats, GitHub engagement

### KPI 5: System Reliability
- **Target**: 99%+ uptime, < 100ms proxy overhead
- **Measurement**: Prometheus metrics + user reports

---

## 11. Roadmap

### Phase 1: v0.1 (Current)
- ✅ Decision engine with Haiku meta-AI
- ✅ Basic capability detection
- ✅ SQLite memory system
- ✅ CLI (start, stop, status)
- ✅ LiteLLM integration
- Target: MVP for single developers

### Phase 2: v0.2 (Month 2)
- Deepseek/Gemini Flash meta-AI options
- Advanced complexity analysis (AST parsing, token counting)
- Model usage dashboard
- Batch request optimization
- Target: Ready for small teams

### Phase 3: v0.3 (Month 3)
- Autonomous learning agent (Ralph mode)
- Scheduled optimization passes
- Cost prediction & budgeting
- IDE plugins (VS Code, Cursor)
- Target: Mainstream adoption

### Phase 4: v1.0 (Month 4)
- Multi-user support
- Team quotas & rate limiting
- Web UI for monitoring
- Production hardening
- Target: Enterprise ready

---

## 12. Constraints & Assumptions

### Constraints
1. Node.js >= 18 required
2. SQLite for local database (no external DB dependencies)
3. Requires network access for OpenRouter pricing (can cache 1h)
4. Supports ANTHROPIC-compatible API only (v1)

### Assumptions
1. Users have at least one API key or local model available
2. OpenRouter available and accessible
3. Users accept some requests may escalate to more expensive model
4. Cost savings priority over slight latency increase

---

## 13. Out of Scope

- Multi-cloud orchestration (AWS, GCP, Azure)
- Custom model fine-tuning
- Real-time collaborative features
- Mobile/web-only support
- Integration with proprietary LLM platforms

---

## 14. References

- [ARCHITECTURE.md](ARCHITECTURE.md) - System design
- [DECISION-ENGINE.md](DECISION-ENGINE.md) - Algorithm details
- [MODEL-TIERS.md](MODEL-TIERS.md) - Model definitions
- [MEMORY-SYSTEM.md](MEMORY-SYSTEM.md) - Database schema
- [README.md](../README.md) - User guide
