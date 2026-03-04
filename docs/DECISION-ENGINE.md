# Decision Engine

## Overview

The Decision Engine is the "brain" of Switch AI. It analyzes incoming requests and determines which model is best suited to handle them, considering task complexity, available resources, cost, and historical performance.

---

## 1. Complexity Analysis

### Methodology

Complexity is determined by analyzing two signals:

1. **Prompt Analysis** - Examine the text of the user's request
2. **Project Context** - Analyze the codebase (file types, imports, size)

### Task Categories

Switch AI classifies all requests into 7 categories:

| Category | Score | Examples | Complexity | Recommended Tier |
|----------|-------|----------|------------|-----------------|
| **Documentation** | 1-3 | README, API docs, comments, guide | Very Low | Free/Cheap |
| **Tests** | 2-4 | Unit tests, integration tests | Low | Cheap |
| **Simple Code** | 3-5 | Utility functions, simple fixes, boilerplate | Low-Medium | Cheap/Balanced |
| **Complex Code** | 6-8 | Feature implementation, refactoring, algorithms | Medium-High | Balanced/Premium |
| **Research** | 5-7 | Analysis, investigation, recommendations | Medium-High | Balanced/Premium |
| **Refactoring** | 6-8 | Code cleanup, restructuring, optimization | Medium-High | Balanced/Premium |
| **Architecture** | 8-10 | System design, major decisions, patterns | Very High | Premium |

### Prompt Analysis Algorithm

**Step 1: Keyword Extraction**

Extract keywords from the request and assign complexity boosts:

```
Documentation Keywords:
  - "README", "document", "guide", "blog", "tutorial", "explain"
  - "comment", "docstring", "javadoc", "describe"
  - Boost: -1 (lower complexity)

Test Keywords:
  - "test", "unit test", "integration test", "mock"
  - "spec", "test case", "validation"
  - Boost: -0.5 (slightly lower)

Simple Code Keywords:
  - "helper", "function", "utility", "simple"
  - "fix", "bug", "patch", "quick"
  - Boost: 0 (neutral)

Complex Code Keywords:
  - "design", "architecture", "pattern", "system"
  - "implement", "complex", "algorithm", "optimization"
  - "refactor", "large", "multi-part"
  - Boost: +1 to +2 (higher complexity)

Research Keywords:
  - "analyze", "research", "investigate", "compare"
  - "explain why", "what is", "how does"
  - Boost: +1 (moderately complex)
```

**Step 2: Base Score Assignment**

Assign base complexity score based on primary category detected:

```typescript
const categoryScores = {
  documentation: 1.5,
  tests: 2.0,
  simpleCode: 4.0,
  complexCode: 6.5,
  research: 5.5,
  refactoring: 6.5,
  architecture: 8.5,
};
```

**Step 3: Modifiers**

Apply modifiers based on request characteristics:

```
Request mentions:
  - "simple", "easy", "basic" → -0.5
  - "hard", "complex", "tricky" → +0.5
  - "broken", "bug", "error" → -0.5 (usually simple fixes)
  - Time constraint mentioned → +0.5 (more careful model needed)

Language mentioned:
  - "documentation" language → complexity -0.5
  - "algorithm" language → complexity +0.5

File types hinted:
  - Just text files → complexity -0.5
  - Multiple language types → complexity +0.5
  - Complex languages (Rust, Scala) → complexity +0.5
```

**Step 4: Finalization**

```
final_score = base_score + keyword_boosts + modifiers
final_score = clamp(1, 10)
complexity_level = "low" if score <= 3 else "medium" if score <= 6 else "high"
```

### Project Context Analysis

When available, analyze the project structure to refine complexity:

```typescript
function analyzeProjectContext(projectPath: string): {
  fileCount: number;
  languages: string[];
  complexity: number;
  frameworks: string[];
  size: "small" | "medium" | "large";
}
```

**Analysis Points**:

1. **File Count**: Large projects (1000+ files) → +0.5 complexity
2. **Language Count**: Multiple languages → +0.3 complexity
3. **Dependencies**: Complex frameworks detected → +0.5
4. **Project Size**:
   - Small (<100 files): no change
   - Medium (100-1000 files): +0.3
   - Large (>1000 files): +0.5

**Example**:
```
Project: Microservices platform
├─ File count: 5000+ files
├─ Languages: TypeScript, Python, Go, Rust
├─ Frameworks: NestJS, FastAPI, gRPC, Actix
├─ Size: Large
└─ Complexity boost: +1.5
```

---

## 2. Classification Decision Tree

```
START
  │
  ├─ Prompt contains ["doc", "readme", "guide", "explain"]? → DOCUMENTATION (score: 2)
  │
  ├─ Prompt contains ["test", "spec", "test case"]? → TESTS (score: 3)
  │
  ├─ Prompt contains ["refactor", "cleanup", "improve"]?
  │  └─ With project context showing existing code? → REFACTORING (score: 7)
  │
  ├─ Prompt contains ["design", "architecture", "system"]?
  │  ├─ With large project context? → ARCHITECTURE (score: 9)
  │  └─ Without context? → RESEARCH (score: 6)
  │
  ├─ Prompt contains ["analyze", "research", "investigate"]? → RESEARCH (score: 5)
  │
  ├─ Prompt contains ["fix", "bug", "error"] + simple language? → SIMPLE CODE (score: 4)
  │
  ├─ Prompt contains ["implement", "create", "write"] + code request?
  │  ├─ Complexity keywords present? → COMPLEX CODE (score: 7)
  │  └─ Simple keywords present? → SIMPLE CODE (score: 4)
  │
  └─ DEFAULT → Estimate based on prompt length and vocabulary
     └─ Short prompt (<50 words) → SIMPLE CODE (score: 4)
        └─ Long prompt (>200 words) → COMPLEX CODE (score: 6)
```

---

## 3. Model Selection Algorithm

### Input

```typescript
interface SelectionInput {
  complexity_score: number;        // 1-10
  category: string;                 // "documentation", "code", etc
  available_models: Model[];        // All models currently available
  user_preferences: {
    max_cost_per_request: number;
    preferred_models: string[];
    blacklist: string[];
  };
  memory: {
    model_success_rates: Map<string, number>;
    model_failure_patterns: string[];
  };
}
```

### Algorithm (Pseudocode)

```
function selectModel(input: SelectionInput): SelectionResult {

  // Step 1: Filter by availability & tier match
  candidates = filter(input.available_models, (model) => {
    return model.isAvailable
      && model.tier_matches_complexity(input.complexity_score)
      && !input.user_preferences.blacklist.contains(model.id);
  });

  // Step 2: Filter by cost constraint
  candidates = filter(candidates, (model) => {
    return model.cost <= input.user_preferences.max_cost_per_request;
  });

  // Step 3: Apply user preferences
  if (input.user_preferences.preferred_models.length > 0) {
    // Prioritize preferred models
    candidates = sort(candidates, (model) => {
      return input.user_preferences.preferred_models.indexOf(model.id);
    });
  }

  // Step 4: Filter out known failures
  candidates = filter(candidates, (model) => {
    success_rate = input.memory.model_success_rates[model.id][input.category];
    return success_rate > MINIMUM_SUCCESS_THRESHOLD (e.g., 0.3);
  });

  // Step 5: If no candidates remain, relax constraints
  if (candidates.isEmpty) {
    candidates = input.available_models
      .filter(m => !input.user_preferences.blacklist.contains(m.id))
      .sort((a, b) => {
        // Sort by: success_rate DESC, cost ASC
        success_a = input.memory.model_success_rates[a.id][input.category] || 0.5;
        success_b = input.memory.model_success_rates[b.id][input.category] || 0.5;
        if (success_a !== success_b) return success_b - success_a;
        return a.cost - b.cost;
      });
  }

  // Step 6: Final ranking
  candidates = sort(candidates, (model) => {
    // Composite score: success * quality - cost
    success_rate = input.memory.model_success_rates[model.id][input.category] || 0.7;
    quality_match = model.quality_match_for_category(input.category);
    cost_normalized = model.cost / MAX_MODEL_COST;

    score = (success_rate * 0.5 + quality_match * 0.4 - cost_normalized * 0.1);

    // Boost for preferred models
    if (input.user_preferences.preferred_models.contains(model.id)) {
      score += 0.2;
    }

    return score;  // Sort descending
  });

  // Step 7: Select top candidate
  selected_model = candidates[0];
  confidence = calculate_confidence(selected_model, input);
  reason = explain_selection(selected_model, input);

  return {
    model: selected_model,
    confidence: confidence,
    reason: reason,
    fallback_chain: candidates.slice(1, 3)  // Next 2 options if this fails
  };
}
```

### Tier Matching Logic

```typescript
function tier_matches_complexity(tier: string, score: number): boolean {
  return (
    (tier === "free" && score <= 3)
    || (tier === "cheap" && score <= 5)
    || (tier === "balanced" && score <= 7)
    || (tier === "premium" && score >= 5)  // Premium handles everything
  );
}
```

### Confidence Calculation

```
confidence = base_confidence
  * success_rate_factor          (0.8-1.0, based on historical data)
  * availability_factor           (0.9-1.0, if model sometimes unavailable)
  * category_match_factor         (0.7-1.0, how well model suits category)

confidence = clamp(0, 1)
```

**Examples**:
- Haiku for documentation: 0.95 (excellent match, 98% success)
- Sonnet for code features: 0.92 (good match, 94% success)
- Opus for architecture: 0.98 (perfect match, 99% success)
- Haiku for architecture: 0.30 (poor match, only 25% success)

### Reason String Generation

```
if (success_rate > 0.9) {
  return `${model.name}: Excellent track record (${success_rate}%) on ${category}`;
}

if (cost < MEDIAN_COST) {
  return `${model.name}: Cost-effective for ${category} ($${cost})`;
}

if (availability_ratio < 1.0) {
  return `${model.name}: Preferred choice, falls back to ${fallback} if unavailable`;
}

if (user_preferred) {
  return `${model.name}: User-selected model for this type of task`;
}

return `${model.name}: Best match for complexity level ${score}/10`;
```

---

## 4. Fallback Strategy

If the selected model fails (quality validation fails), automatically escalate:

```
Primary: Haiku
├─ Fallback 1: Sonnet (better capability)
├─ Fallback 2: Opus (best quality guarantee)
└─ Fallback 3: Ask user for input

Primary: Sonnet
├─ Fallback 1: Opus (more capable)
└─ Fallback 2: Try Deepseek (lateral move)

Primary: Opus
├─ Fallback 1: Try with extended context window
└─ Fallback 2: Fail and report to user
```

**Retry Logic**:
```typescript
const RETRY_CONFIG = {
  max_retries: 2,
  backoff_ms: 1000,
  escalation_factor: 1.5  // Each retry uses more expensive model
};
```

---

## 5. Meta-AI Decision Maker

For difficult classification cases, Switch AI can use a meta-AI (Haiku/Deepseek/Gemini Flash) to analyze the request:

**Prompt Template**:
```
You are an expert at classifying AI tasks by complexity.

Given this user request, output JSON with:
{
  "complexity_score": <1-10>,
  "category": "<documentation|tests|simple-code|complex-code|research|refactor|architecture>",
  "reasoning": "<brief explanation>"
}

Request:
---
{user_request}
---

Additional context (if available):
{project_context}

Output JSON only, no explanation:
```

**When Used**:
- Complex multi-faceted requests
- Mixed task types
- User explicitly unsure
- Confidence score < 0.5 from heuristic analysis

**Performance Impact**:
- Adds ~200-500ms latency
- Minimal cost ($0.001-0.003 with Haiku)
- Improves accuracy when used

---

## 6. Learning & Feedback Loop

Every request is evaluated post-completion:

```
Request Made
  │
  ├─ [1] Model selected → logged
  │
  ├─ [2] Response generated → logged
  │
  ├─ [3] Validation run → result logged
  │
  └─ [4] Update memory
      ├─ model_performance.success_rate ↑ or ↓
      ├─ If failed: failure_patterns entries added
      └─ If repeated failure: Auto-blacklist model
```

### Feedback Query Examples

**Query 1: Success Rate for Category**
```sql
SELECT
  model,
  category,
  (successes / NULLIF(attempts, 0))::float AS success_rate
FROM model_performance
WHERE category = 'documentation'
ORDER BY success_rate DESC;

-- Result:
-- haiku, documentation, 0.98
-- opus, documentation, 0.99
-- sonnet, documentation, 0.94
```

**Query 2: Find Blacklisted Models**
```sql
SELECT DISTINCT model
FROM failure_patterns
WHERE blacklist_until > NOW();

-- Result:
-- deepseek (blacklisted until tomorrow)
-- ollama-mistral (blacklisted until next week)
```

**Query 3: Cost-Effectiveness**
```sql
SELECT
  model,
  category,
  (successes / NULLIF(attempts, 0))::float AS success_rate,
  avg_cost,
  (avg_cost / (successes / NULLIF(attempts, 0))) AS cost_per_success
FROM model_performance
WHERE category = 'tests'
ORDER BY cost_per_success ASC;

-- Best bang for buck:
-- haiku, 0.96 success rate, $0.001, cost_per_success=$0.0010
-- deepseek, 0.88 success rate, $0.0008, cost_per_success=$0.0009
```

---

## 7. Configuration & Customization

Users can customize decision making via `~/.switch-ai/config.json`:

```json
{
  "complexityOffsets": {
    "documentation": -0.5,
    "tests": -0.3,
    "architecture": +0.5
  },
  "modelPreferences": {
    "documentation": ["haiku", "gemini-flash"],
    "tests": ["haiku", "deepseek"],
    "code": ["sonnet", "opus"],
    "architecture": ["opus"]
  },
  "tierConstraints": {
    "maxCostPerRequest": 0.10,
    "prioritizeFree": true,
    "prioritizeLocal": false
  },
  "escalationPolicy": {
    "maxRetries": 2,
    "onFailure": "escalate",  // or "fail"
    "escalationDelay": 500
  }
}
```

---

## 8. Examples

### Example 1: Documentation Task

```
Input:
{
  "request": "Write a comprehensive API documentation for my REST endpoints",
  "project_context": null
}

Processing:
├─ Keyword analysis: "documentation", "API", "write"
│  └─ Detected: documentation, boost: -1
├─ Base score: 1.5 (documentation category)
├─ Final score: 1.5 - 1.0 = 0.5 → Clamped to 1.0
├─ Complexity: "very low"
├─ Category: "documentation"
│
├─ Model Selection:
│  ├─ Available: [Claude Code (free), Haiku, Sonnet, Opus]
│  ├─ Tier match: Free tier (score ≤ 3)
│  ├─ Success rates: Haiku 98%, Sonnet 94%, Opus 99%
│  ├─ Cost: Free > Haiku ($0.001) > Sonnet ($0.01) > Opus ($0.10)
│  ├─ Selection: Claude Code (free tier, 98% success)
│  └─ Confidence: 0.98
│
└─ Result:
   {
     "model": "claude-code",
     "confidence": 0.98,
     "reason": "Claude Code Haiku: Excellent track record (98%) on documentation",
     "fallback": ["haiku", "sonnet"]
   }
```

### Example 2: Complex Feature Implementation

```
Input:
{
  "request": "Implement a distributed rate limiting system with Redis backend, supporting multiple strategies (token bucket, sliding window, leaky bucket) and graceful degradation",
  "project_context": {
    "fileCount": 250,
    "languages": ["TypeScript", "Python"],
    "frameworks": ["NestJS", "FastAPI"]
  }
}

Processing:
├─ Keyword analysis: "distributed", "complex", "system", "implement"
│  └─ Detected: architecture/complex-code, boost: +1.5
├─ Base score: 6.5 (complex code)
├─ Project modifier: +0.5 (multiple languages, frameworks)
├─ Final score: 6.5 + 1.5 + 0.5 = 8.5
├─ Complexity: "high"
├─ Category: "complex-code"
│
├─ Model Selection:
│  ├─ Available: [Haiku, Sonnet, Opus, Deepseek]
│  ├─ Tier match: Premium tier (score ≥ 7)
│  ├─ Success rates: Opus 98%, Sonnet 82%, Deepseek 45%
│  ├─ Cost: Sonnet ($0.01) < Opus ($0.15) < Premium options
│  ├─ Claude Code credit: 5 remaining (reserve for critical work)
│  ├─ Meta-AI confirmation: Score 8.5/10 confirmed
│  ├─ Selection: Opus (best for complex, critical work)
│  └─ Confidence: 0.96
│
└─ Result:
   {
     "model": "claude-opus",
     "confidence": 0.96,
     "reason": "Claude Opus: Best match for high-complexity distributed system design (8.5/10)",
     "fallback": ["sonnet", "claude-code"]
   }
```

### Example 3: Escalation Scenario

```
Request: "Write unit tests for my authentication module"
Expected: Haiku selected (tests category, score 3)

Step 1: Haiku selected & executed
├─ Response received
├─ Validation check:
│  ├─ Completeness: OK
│  ├─ Code syntax: FAILED (invalid test framework syntax)
│  ├─ Known patterns: Matches "incomplete-mocks" failure
│  └─ Decision: ESCALATE

Step 2: Escalation #1 → Sonnet
├─ Sonnet executes
├─ Response received
├─ Validation:
│  ├─ Completeness: OK
│  ├─ Code syntax: OK
│  ├─ Framework: Jest syntax correct
│  └─ Decision: PASS

Step 3: Logging
├─ INSERT request (tests, haiku, failed, escalated)
├─ INSERT request (tests, sonnet, success, escalation=1)
├─ UPDATE model_performance (haiku -1 success, sonnet +1 success)
├─ INSERT failure_pattern (haiku, tests, "invalid-test-syntax")
├─ Cost: $0.005 (paid to Sonnet)

Final:
├─ User receives: Complete, validated test suite
├─ Learning: Haiku future success rate on tests: 97% → 96%
└─ Future: Tests still route to Haiku 96% of time (decent), but escalation threshold adjusted
```

---

## 9. Metrics & Monitoring

**Key Metrics**:
- Classification accuracy (vs. human judgment)
- Escalation rate (should be < 5%)
- False negatives (cheap model could have succeeded)
- False positives (expensive model wasn't needed)
- Cost per success (total cost / successful requests)
- Latency of decision engine (target: <500ms)

**Health Checks**:
- Decision accuracy improving over time?
- Any models stuck in blacklist?
- Model success rates converging?
- Cost trending down (v0.1) or stabilizing (v1.0)?
