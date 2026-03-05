# 🤖 Switch AI

> **Intelligent model router that automatically selects the best AI model for your task, optimizing cost and performance while learning from experience.**

Switch AI is an automated decision engine that routes your AI tasks to the most cost-effective and capable model available. Instead of wasting expensive Claude Opus tokens on simple documentation tasks, Switch AI analyzes your request and intelligently chooses between free tier models, cheap alternatives, or premium models based on complexity, cost, and historical performance.

## 🎯 Why Switch AI?

### The Problem
- **Token waste**: Using Claude Opus for every task (including simple docs/tests) is expensive
- **Resource underutilization**: Cheap models (Haiku, Deepseek) sit unused while you burn through premium quota
- **Manual overhead**: Constantly switching between ANTHROPIC_BASE_URL, OpenRouter, local models
- **No learning**: When a cheap model fails, you forget about it and retry anyway

### The Solution
Switch AI automates the entire decision process:

```
┌─────────────────────────────────────────┐
│  Your Task (standard ANTHROPIC request) │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│    Complexity Analysis                  │
│  (prompt + project context)             │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Decision Engine (Meta-AI)              │
│  → Check available tools & credits      │
│  → Query OpenRouter prices              │
│  → Consult learning memory              │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Route to Best Model                    │
│  → Claude Code CLI                      │
│  → OpenRouter (Haiku, Deepseek, etc)    │
│  → Gemini CLI                           │
│  → Ollama (local models)                │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Validate Response Quality              │
│  → If good: return result               │
│  → If poor: escalate to better model    │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Learn from Experience                  │
│  → Log performance to SQLite            │
│  → Update model ratings                 │
└─────────────────────────────────────────┘
```

## 🚀 Quick Start

### Installation

```bash
# Install globally (recommended)
npm install -g switch-ai

# Or run directly without installation
npx switch-ai start
```

### Usage Option 1: CLI

```bash
# Start the Switch AI proxy server
switch-ai start

# In another terminal, use it like a normal ANTHROPIC API
export ANTHROPIC_BASE_URL=http://localhost:4000
export ANTHROPIC_API_KEY=your-key

# Now your requests automatically route through Switch AI!
# Simple tasks → Cheap models (Haiku, Deepseek)
# Complex tasks → Powerful models (Opus, Claude 3.5 Sonnet)
```

### Usage Option 2: With Claude Code VSCode Extension

```bash
# One-liner: Start proxy + launch Claude Code CLI with routing
switch-ai claude

# VSCode users: Configure your extension (settings.json):
# {
#   "claude.baseURL": "http://localhost:4000/v1"
# }
#
# Then use Claude Code extension normally - Switch AI routes automatically!
```

See [VSCODE-INTEGRATION.md](docs/VSCODE-INTEGRATION.md) for full VSCode setup.

### Example: Node.js Integration

```javascript
import Anthropic from "@anthropic-ai/sdk";

// Switch AI automatically handles model selection
const client = new Anthropic({
  baseURL: "http://localhost:4000/v1",
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const message = await client.messages.create({
  model: "auto", // Switch AI decides which model to use
  max_tokens: 1024,
  messages: [
    {
      role: "user",
      content: "Write unit tests for my login function",
    },
  ],
});
```

## 📋 How It Works

### 1️⃣ **Capability Detection**

Switch AI discovers what's available on your system:

- ✅ **Claude Code CLI** - `claude` command
- ✅ **Gemini CLI** - `gemini` command
- ✅ **Ollama** - Local open-source models
- ✅ **API Keys** - OpenRouter, Anthropic, OpenAI, etc.
- ✅ **Credit Status** - Remaining Claude Code quota

### 2️⃣ **Complexity Classification**

Your task is analyzed and classified:

| Category | Examples | Recommended Model |
|----------|----------|-------------------|
| **Documentation** | README, API docs, comments | Free tier / Haiku |
| **Unit Tests** | Jest tests, simple validation | Haiku / Deepseek |
| **Simple Code** | Utility functions, fixes | Haiku / Sonnet |
| **Complex Code** | Architecture, large features | Opus / Sonnet |
| **Research** | Analysis, investigation | Sonnet / Opus |
| **Refactoring** | Code cleanup, restructuring | Sonnet |
| **Architecture** | System design, decisions | Opus |

### 3️⃣ **Smart Model Selection**

Decision engine considers:

- **Cost**: OpenRouter prices updated hourly
- **Availability**: Only uses available models/credits
- **Complexity match**: Right model for task difficulty
- **Historical performance**: Learn from past failures
- **Fallback chain**: Graceful degradation if model fails

### 4️⃣ **Quality Validation**

Before returning results, Switch AI validates:

- ✓ Response completeness (not truncated)
- ✓ Code compilation (if applicable)
- ✓ Coherence and structure
- ✓ Against known failure patterns

If validation fails → automatically escalates to a better model.

### 5️⃣ **Learning & Memory**

Every request is logged to SQLite database:

```sql
-- Track model performance
SELECT model, success_rate, avg_latency
FROM model_performance
WHERE task_category = 'code'
ORDER BY cost ASC;

-- Identify problem patterns
SELECT model, error_type, count(*)
FROM failures
GROUP BY model, error_type;
```

Models with consistent failures get temporarily blacklisted.

## 🎛️ Configuration

### Environment Variables

```bash
# Core
SWITCH_AI_PORT=4000                    # Proxy server port
SWITCH_AI_LOG_LEVEL=info              # debug, info, warn, error

# API Keys (optional, auto-detected)
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-...
GEMINI_API_KEY=...

# Model Preferences
SWITCH_AI_PREFER_LOCAL_MODELS=false   # Prioritize Ollama over API
SWITCH_AI_STRICT_MODE=false           # Require exact model match

# Memory
SWITCH_AI_MEMORY_PATH=~/.switch-ai    # SQLite database location
SWITCH_AI_MEMORY_RETENTION=90         # Days to keep history
```

### Config File

Edit `~/.switch-ai/config.json`:

```json
{
  "defaultTier": "balanced",
  "maxCostPerRequest": 0.01,
  "validateResponses": true,
  "escalationRetries": 2,
  "modelPreferences": {
    "documentation": "haiku",
    "tests": "haiku",
    "simpleCode": "sonnet",
    "complexCode": "opus",
    "research": "opus"
  },
  "blacklistedModels": [],
  "localModelsFirst": false
}
```

See [CONFIGURATION.md](docs/CONFIGURATION.md) for full options.

## 🛠️ Commands

### Quick Start with Claude Code

```bash
# One-liner: Start Switch AI + export env var + launch Claude Code
switch-ai claude

# This will:
# ✓ Start proxy server (localhost:4000)
# ✓ Export ANTHROPIC_BASE_URL=http://localhost:4000
# ✓ Launch Claude Code CLI
# ✓ Display connection info

# You can then use Claude Code normally and requests route through Switch AI
claude --help  # Claude now uses the switched models!
```

### API Key Management

```bash
# Add/update API key interactively
switch-ai keys set openrouter

# Or directly from command line
switch-ai keys set openrouter sk-or-...
switch-ai keys set anthropic sk-ant-...
switch-ai keys set gemini <your-key>

# List stored keys (masked for security)
switch-ai keys list

# Export keys to .env file
switch-ai keys export > .env

# Remove key
switch-ai keys remove openrouter
```

### Core Commands

```bash
# Start the proxy server
switch-ai start

# Stop running server
switch-ai stop

# Check status
switch-ai status

# View available models
switch-ai models

# Configure settings
switch-ai config set defaultTier balanced
switch-ai config get defaultTier

# View learning history
switch-ai history [--task-type] [--model] [--limit 50]

# Reset learning memory (clear history)
switch-ai reset-memory

# Run in debug mode
switch-ai start --debug

# Show version
switch-ai --version
```

See [CLI-REFERENCE.md](docs/CLI-REFERENCE.md) for complete command documentation.

## 📊 Model Selection Examples

### Example 1: Write Documentation

**Request**: "Write a comprehensive README for my Node.js project"

**Analysis**:
- Complexity: Low (documentation)
- Estimated tokens: 300-500
- Cost with Opus: ~$0.30
- Cost with Haiku: ~$0.003

**Decision**: Use **Haiku** (100x cheaper) ✅

### Example 2: Complex Feature Implementation

**Request**: "Implement a distributed cache layer with Redis cluster support and failover"

**Analysis**:
- Complexity: Very High (architecture)
- Estimated tokens: 3000-5000
- Haiku success rate: 15% (from memory)
- Opus success rate: 95% (from memory)

**Decision**: Use **Opus** (worth the cost for reliability) ✅

### Example 3: Fallback Scenario

**Request**: "Refactor this component to use modern React hooks"

**Analysis**:
- Complexity: Medium-High
- Try: Sonnet (good balance)

**If Sonnet fails** (quality validation fails):
- Escalate to: Opus
- Log failure: "Sonnet struggled with hook migration"
- Update memory: Decrease Sonnet score for hook tasks

## 🎓 Understanding Model Tiers

Switch AI organizes models into cost/capability tiers:

### **Free Tier**
- No cost (if already credited)
- Examples: Claude Code CLI, Gemini CLI (free tier)
- Best for: Docs, simple tests, boilerplate

### **Cheap Tier** (~$0.001-0.003 per request)
- Claude Haiku, Deepseek Chat, Gemini 2.0 Flash
- Best for: Tests, simple code, fixes

### **Balanced Tier** (~$0.01-0.03 per request)
- Claude Sonnet, Claude 3.5 Sonnet
- Best for: Code features, research, refactoring

### **Premium Tier** (~$0.05-0.30 per request)
- Claude Opus, Claude 4.6, GPT-4
- Best for: Architecture, complex features, critical tasks

See [MODEL-TIERS.md](docs/MODEL-TIERS.md) for detailed breakdown.

## 📚 Documentation

### Core Documentation
- **[PRD.md](docs/PRD.md)** - Product requirements and vision
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System design and components
- **[DECISION-ENGINE.md](docs/DECISION-ENGINE.md)** - Algorithm details
- **[MODEL-TIERS.md](docs/MODEL-TIERS.md)** - Model definitions and selection criteria
- **[MEMORY-SYSTEM.md](docs/MEMORY-SYSTEM.md)** - Learning database schema

### Setup & Usage
- **[INSTALLATION.md](docs/INSTALLATION.md)** - Detailed setup guide
- **[CONFIGURATION.md](docs/CONFIGURATION.md)** - Environment variables and config
- **[CLI-REFERENCE.md](docs/CLI-REFERENCE.md)** - Complete command reference
- **[VSCODE-INTEGRATION.md](docs/VSCODE-INTEGRATION.md)** - Use with Claude Code extension

## 💡 Use Cases

### 👨‍💼 Freelance Developers
- **Problem**: Variable income, expensive token usage eats into profits
- **Solution**: Automatically use cheap models for routine tasks, preserve premium credits for complex work
- **Savings**: 60-80% reduction in token spend on typical project

### 🏢 Small Team Startups
- **Problem**: Shared Claude Code subscriptions, one person burns through all credits
- **Solution**: Centralized Switch AI proxy routes work based on complexity, fair distribution
- **Savings**: Extend subscription value 3-5x, avoid upgrading

### 🔬 Research Teams
- **Problem**: Mix of literature review, coding, and analysis—can't waste time switching tools
- **Solution**: Single entry point, let Switch AI handle routing
- **Benefit**: Faster workflows, better resource allocation

### 🏫 Academic Programs
- **Problem**: Teaching programming with cost-effective AI feedback
- **Solution**: Switch AI automatically uses cheap models for student assignments
- **Savings**: 10x cost reduction compared to always using powerful models

## 🔒 Security & Privacy

- **Local-first**: Memory database stored locally in `~/.switch-ai/`
- **Proxy control**: Central point to monitor and audit AI usage
- **No tracking**: Switch AI doesn't send data anywhere
- **API key handling**: Keys stay in environment, never logged

## 🚀 Roadmap

### v0.1 (Initial Release)
- [ ] Basic decision engine with Haiku meta-AI
- [ ] SQLite memory system
- [ ] LiteLLM proxy integration
- [ ] CLI with start/stop/status

**Tarefas Atuais**:
- `add-dashboard`: Implementar dashboard de monitoramento.
- `switch-ai-v0.1`: Finalizar a versão inicial do projeto.

### v0.2 (Enhancement)
- [ ] Deepseek/Gemini meta-AI support
- [ ] Advanced complexity analysis with project context
- [ ] Model usage dashboard
- [ ] Batch request optimization

### v0.3 (Automation)
- [ ] Autonomous learning agent (Ralph mode)
- [ ] Scheduled optimization passes
- [ ] Cost prediction and budgeting
- [ ] Integration with IDEs (VS Code, Cursor)

### v1.0 (Production Ready)
- [ ] Multi-user support and usage tracking
- [ ] Team quotas and rate limiting
- [ ] Web UI for monitoring
- [ ] Publish to NPM registry

## 🤝 Contributing

Contributions welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 License

MIT

## 🙋 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/switch-ai/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/switch-ai/discussions)
- **Documentation**: [docs/](docs/)

---

**Built with ❤️ to help you spend your tokens wisely.**
