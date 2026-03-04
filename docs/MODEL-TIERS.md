# Model Tiers & Selection Criteria

Switch AI organizes AI models into **tiers** based on capability and cost. This document defines each tier and the selection criteria used to match tasks to appropriate models.

---

## Tier Hierarchy

```
┌────────────────────────────────────────────────────────┐
│ PREMIUM ($0.05-0.30/req) - Best for critical work      │
│ • Claude Opus, Claude 4.6, GPT-4o, Gemini Pro          │
├────────────────────────────────────────────────────────┤
│ BALANCED ($0.01-0.03/req) - Good for real work         │
│ • Claude Sonnet, GPT-4 Turbo, Gemini 1.5 Pro          │
├────────────────────────────────────────────────────────┤
│ CHEAP ($0.001-0.003/req) - Excellent for routine work  │
│ • Claude Haiku, Deepseek, Gemini 2.0 Flash             │
├────────────────────────────────────────────────────────┤
│ FREE ($ 0/req) - Best for simple tasks with credits     │
│ • Claude Code CLI, Gemini CLI (free), Ollama local      │
└────────────────────────────────────────────────────────┘
```

---

## Free Tier

**Characteristics**:
- Zero marginal cost (if you have credits or local models)
- Speed: Fast (local) to Medium (cloud)
- Quality: Good for simple tasks, limited for complex
- Reliability: High uptime
- Context: Limited (often 4k-8k tokens)

**Models**:

### Claude Code CLI
- **Name**: Claude Code (Opus, Sonnet, Haiku available via CLI)
- **Cost**: $0 (uses your subscription credit)
- **Best For**: Any task where you have available credits
- **Limitations**: Limited to installed Anthropic models
- **Command**: `claude --model <tier> --input <file>`
- **Context Window**: 200k (Opus), 200k (Sonnet), 200k (Haiku)

### Gemini CLI (Free Tier)
- **Name**: Gemini Flash (free tier limited)
- **Cost**: $0 (limited free API quota)
- **Best For**: Quick text analysis, simple documentation
- **Limitations**: Rate limited, reduced quota
- **Command**: `gemini prompt "<text>"`
- **Context Window**: 1M tokens

### Ollama (Local Models)
- **Name**: Ollama + various OSS models
- **Cost**: $0 (runs locally)
- **Best For**: Complete privacy, offline capability
- **Models Available**:
  - `llama2` (7B, 13B, 70B)
  - `mistral` (7B, small-fast)
  - `neural-chat`
  - `dolphin-mixtral`
  - Others: https://ollama.ai/library
- **Limitations**: Slower than cloud, variable quality, need local GPU
- **Context Window**: 2k-4k (varies)

**Selection Priority** (when available):
1. Claude Code (if credit available and complexity matches)
2. Gemini Flash free (if quota available)
3. Ollama (if model available and privacy preferred)

---

## Cheap Tier

**Characteristics**:
- Cost: $0.001-0.003 per request (typical request)
- Speed: Medium (cloud-based)
- Quality: Very good for routine work, sufficient for most tasks
- Reliability: 99%+ uptime
- Context: 4k-200k tokens

**Models**:

### Claude Haiku
- **Provider**: Anthropic via OpenRouter
- **Cost**: ~$0.001 per 1k output tokens
- **Best For**: Documentation, tests, simple code, explanations
- **Strengths**:
  - Exceptional value for money
  - Fast response times
  - Good code generation quality
  - Strong on explanations and summaries
- **Weaknesses**:
  - Struggles with very complex logic (architecture)
  - Limited reasoning depth
  - May truncate for very long outputs
- **Context Window**: 200k
- **Typical Request Cost**: $0.001-0.003
- **Success Rate by Category**:
  - Documentation: 98%
  - Tests: 96%
  - Simple Code: 94%
  - Complex Code: 25%
  - Research: 70%
  - Refactoring: 80%
  - Architecture: 10%

### Deepseek Chat (OpenRouter)
- **Provider**: Deepseek via OpenRouter
- **Cost**: ~$0.0008 per 1k output tokens (even cheaper than Haiku!)
- **Best For**: Code generation, tests, explanations
- **Strengths**:
  - Lowest cost
  - Excellent code quality
  - Good reasoning
  - Fast responses
- **Weaknesses**:
  - Newer model (less battle-tested)
  - May struggle with edge cases
  - Limited context (4k)
- **Context Window**: 4k
- **Typical Request Cost**: $0.0005-0.0015
- **Success Rate by Category**:
  - Documentation: 92%
  - Tests: 88%
  - Simple Code: 90%
  - Complex Code: 50%
  - Research: 65%
  - Refactoring: 75%
  - Architecture: 20%

### Gemini 2.0 Flash
- **Provider**: Google via API
- **Cost**: ~$0.0075 per 1k input + output tokens (free tier available)
- **Best For**: Text analysis, summaries, explanations
- **Strengths**:
  - Very fast
  - Excellent on text tasks
  - Free tier available
  - Reasoning capabilities
- **Weaknesses**:
  - Code generation quality varies
  - API quota limits
  - Less established than Claude
- **Context Window**: 1M
- **Typical Request Cost**: $0.001-0.003
- **Success Rate by Category**:
  - Documentation: 85%
  - Tests: 70%
  - Simple Code: 72%
  - Complex Code: 40%
  - Research: 80%
  - Refactoring: 60%
  - Architecture: 15%

**Selection Recommendation**:
- **First choice**: Haiku (most reliable cheap option)
- **Second choice**: Deepseek (lowest cost, good code)
- **Third choice**: Gemini Flash (fast, good for text)

---

## Balanced Tier

**Characteristics**:
- Cost: $0.01-0.03 per request (typical)
- Speed: Medium
- Quality: Very good for most tasks, good for complex work
- Reliability: 99%+ uptime
- Context: 100k-200k tokens

**Models**:

### Claude Sonnet (Latest)
- **Provider**: Anthropic via OpenRouter or direct API
- **Cost**: ~$0.003 per 1k input + $0.015 per 1k output tokens
- **Best For**: Feature implementation, research, refactoring, most production code
- **Strengths**:
  - Excellent code quality
  - Good reasoning and analysis
  - Handles complex tasks well
  - Reliable and consistent
  - Very good value/performance ratio
- **Weaknesses**:
  - Not ideal for simple doc tasks (overkill)
  - Slightly slower than Haiku
- **Context Window**: 200k
- **Typical Request Cost**: $0.01-0.03
- **Success Rate by Category**:
  - Documentation: 94%
  - Tests: 93%
  - Simple Code: 96%
  - Complex Code: 94%
  - Research: 92%
  - Refactoring: 95%
  - Architecture: 75%

### Claude 3.5 Sonnet
- **Provider**: Anthropic (newer variant)
- **Cost**: ~$0.003 per 1k input + $0.015 per 1k output tokens (same as Sonnet)
- **Best For**: Same as Claude Sonnet (this is the recommended version going forward)
- **Strengths**:
  - Improved from Claude 3 Sonnet
  - Better code understanding
  - Faster processing
- **Weaknesses**: Same as Sonnet
- **Context Window**: 200k
- **Typical Request Cost**: $0.01-0.03
- **Success Rate**: Slightly better than Sonnet (2-3% improvement)

### GPT-4 Turbo
- **Provider**: OpenAI via API
- **Cost**: ~$0.01 per 1k input + $0.03 per 1k output tokens
- **Best For**: Complex code, reasoning, analysis
- **Strengths**:
  - Excellent reasoning
  - Good at debugging complex issues
  - Strong on math and logic
- **Weaknesses**:
  - Slightly higher cost
  - Not always best for code generation
  - Newer API might have quirks
- **Context Window**: 128k
- **Typical Request Cost**: $0.02-0.04
- **Success Rate by Category**:
  - Documentation: 91%
  - Tests: 89%
  - Simple Code: 92%
  - Complex Code: 88%
  - Research: 95%
  - Refactoring: 90%
  - Architecture: 80%

**Selection Recommendation**:
- **First choice**: Claude Sonnet (best value, most reliable)
- **Second choice**: GPT-4 Turbo (if you need extra reasoning)

---

## Premium Tier

**Characteristics**:
- Cost: $0.05-0.30+ per request (high!)
- Speed: Medium-Slow
- Quality: Excellent, can handle any task
- Reliability: 99%+ uptime
- Context: 200k+ tokens

**Models**:

### Claude Opus
- **Provider**: Anthropic via OpenRouter or direct API
- **Cost**: ~$0.015 per 1k input + $0.075 per 1k output tokens
- **Best For**: Critical tasks, architecture, complex reasoning
- **Strengths**:
  - Best-in-class reasoning
  - Excellent code quality
  - Handles very complex problems
  - Best for critical production work
- **Weaknesses**:
  - Expensive (60x more than Haiku)
  - Slower responses
  - Overkill for simple tasks
- **Context Window**: 200k
- **Typical Request Cost**: $0.05-0.30
- **Success Rate by Category**:
  - Documentation: 99%
  - Tests: 98%
  - Simple Code: 99%
  - Complex Code: 98%
  - Research: 98%
  - Refactoring: 99%
  - Architecture: 99%

### Claude 4.6
- **Provider**: Anthropic (newest, most capable)
- **Cost**: Similar to Opus (awaiting pricing)
- **Best For**: Cutting-edge tasks, research, latest capabilities
- **Strengths**:
  - Newest and most capable
  - Improved training
  - Better understanding of latest tech
- **Weaknesses**:
  - Very expensive
  - Pricing may be higher than Opus
  - May not be necessary for most tasks
- **Context Window**: 200k+
- **Status**: Pre-release / limited availability

### GPT-4o (Omni)
- **Provider**: OpenAI
- **Cost**: ~$0.005 per 1k input + $0.015 per 1k output (cheaper than Opus!)
- **Best For**: Multimodal tasks, complex reasoning, images
- **Strengths**:
  - Can process images
  - Excellent reasoning
  - Good for multimodal tasks
  - Actually cheaper than Opus
- **Weaknesses**:
  - Not always best for pure code
  - API may be less stable
- **Context Window**: 128k
- **Typical Request Cost**: $0.02-0.05
- **Success Rate**: Similar to Opus for text tasks

### Gemini Pro / Pro 2
- **Provider**: Google (paid API)
- **Cost**: ~$0.0075 per 1k input + $0.015 per 1k output (cheaper!)
- **Best For**: Reasoning, analysis, text-heavy tasks
- **Strengths**:
  - Actually cheaper than other premium models
  - Excellent reasoning
  - Large context window
  - Multimodal support
- **Weaknesses**:
  - Code generation not as strong
  - API less mature than Claude/OpenAI
- **Context Window**: 1M
- **Typical Request Cost**: $0.01-0.03

**Selection Recommendation**:
- **First choice**: Claude Opus (most reliable, best for critical work)
- **Second choice**: GPT-4o (if cheaper, or if image support needed)
- **Third choice**: Gemini Pro (if you prefer Google or need large context)

---

## Tier Selection Matrix

Use this matrix to quickly determine which tier to try first:

| Task | Complexity | Recommended Tier | Top Model | Fallback |
|------|-----------|-----------------|-----------|----------|
| README, Guide | 1-2 | Free/Cheap | Claude Code / Haiku | Deepseek |
| Blog post, Tutorial | 2-3 | Free/Cheap | Haiku | Deepseek |
| Unit tests | 2-4 | Cheap | Haiku | Deepseek |
| Bug fix | 3-5 | Cheap | Haiku | Sonnet |
| Simple utility | 4-5 | Cheap/Balanced | Deepseek | Sonnet |
| Feature implementation | 5-7 | Balanced | Sonnet | Opus |
| Code refactoring | 6-7 | Balanced | Sonnet | Opus |
| Research/Analysis | 5-7 | Balanced | Sonnet | GPT-4 Turbo |
| Complex algorithm | 7-8 | Premium | Opus | GPT-4o |
| System architecture | 8-10 | Premium | Opus | Claude 4.6 |
| Critical production bug | 7-9 | Premium | Opus | Claude 4.6 |

---

## Cost Comparison Table

**For 1,000 token output request** (typical):

| Model | Input Cost | Output Cost | Total | Relative Cost |
|-------|-----------|------------|-------|---|
| Ollama (local) | $0 | $0 | **$0** | 1x baseline |
| Claude Code (credit) | $0 | $0 | **$0** | 1x baseline |
| Deepseek Chat | $0 | $0.0001 | **$0.0001** | 0.1x |
| Gemini Flash | $0.0001 | $0.0001 | **$0.0002** | 0.2x |
| Claude Haiku | $0 | $0.001 | **$0.001** | 1x |
| Gemini 2.0 Flash | $0.0004 | $0.0001 | **$0.0005** | 0.5x |
| Claude Sonnet | $0.0001 | $0.015 | **$0.0151** | 15x |
| GPT-4 Turbo | $0.001 | $0.03 | **$0.031** | 31x |
| Gemini Pro | $0.00125 | $0.025 | **$0.02625** | 26x |
| Claude Opus | $0.0005 | $0.075 | **$0.0755** | 76x |
| GPT-4o | $0.00025 | $0.015 | **$0.01525** | 15x |
| Claude 4.6 | Unknown | Unknown | **~$0.10+** | ~100x |

---

## Recommended Tier Defaults

### For Individuals
```json
{
  "defaultTier": "cheap",
  "maxCostPerRequest": 0.01,
  "preferences": {
    "documentation": "free",
    "tests": "cheap",
    "code": "balanced",
    "architecture": "premium"
  }
}
```

### For Small Teams (2-5 people)
```json
{
  "defaultTier": "balanced",
  "maxCostPerRequest": 0.05,
  "preferences": {
    "documentation": "cheap",
    "tests": "cheap",
    "code": "balanced",
    "architecture": "premium"
  }
}
```

### For Startups (5-20 people)
```json
{
  "defaultTier": "balanced",
  "maxCostPerRequest": 0.10,
  "preferences": {
    "documentation": "cheap",
    "tests": "cheap",
    "code": "balanced",
    "architecture": "premium",
    "critical_production": "premium"
  }
}
```

### For Cost Optimization Mode
```json
{
  "defaultTier": "cheap",
  "maxCostPerRequest": 0.001,
  "preferences": {
    "*": "cheap"  // Use cheap tier for everything
  }
}
```

---

## Migration Path (Task -> Tier)

When Switch AI encounters a task, it follows this logic:

```
START with CHEAP tier
├─ SUCCESS? → DONE
├─ FAILURE? →
   ├─ Escalate to BALANCED
   ├─ SUCCESS? → DONE
   ├─ FAILURE? →
   │  ├─ Escalate to PREMIUM
   │  ├─ SUCCESS? → DONE
   │  └─ FAILURE? → Report to user
   └─ If cost exceeded → Use cheapest viable option
```

---

## Custom Tier Configuration

Users can define custom tiers if needed:

```json
{
  "customTiers": {
    "my-cheap": {
      "models": ["haiku", "deepseek"],
      "maxCost": 0.002
    },
    "my-expensive": {
      "models": ["opus", "gpt-4-turbo"],
      "minQualityThreshold": 0.9
    }
  }
}
```

---

## Monitoring & Adjustments

Switch AI tracks:
- **Cost per request** (across all tiers)
- **Quality per tier** (success rate)
- **User satisfaction** (escalation rate)

Over time, tiers can be adjusted:
- If cheap models underperform → increase success threshold
- If premium models unused → consider moving to balanced
- If costs trending up → shift more work to cheap tier

---

## Future Tier Additions

As new models become available, they'll be categorized:
- Claude 5 / GPT-5 → New "Ultra Premium" tier
- More open-source models → Enhance "Cheap" tier
- Specialized models → New task-specific tiers
