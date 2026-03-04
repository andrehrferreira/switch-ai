# Configuration Guide

Complete reference for configuring Switch AI via environment variables and `config.json`.

---

## Configuration Hierarchy

Switch AI applies configuration in this order (highest to lowest priority):

1. **Command-line flags** - Immediate override
2. **Environment variables** - Flexible, per-session
3. **Config file** (`~/.switch-ai/config.json`) - Persistent settings
4. **Defaults** - Built-in defaults

Example: If you set `--port 5000` on CLI, it overrides env var `SWITCH_AI_PORT` and config file.

---

## Configuration File

Location: `~/.switch-ai/config.json`

**Auto-created** on first run with sensible defaults.

### Example Config

```json
{
  "version": "0.1.0",

  "server": {
    "port": 4000,
    "host": "localhost",
    "cors": true,
    "logFile": null,
    "logLevel": "info"
  },

  "models": {
    "defaultTier": "balanced",
    "preferredModels": ["sonnet", "haiku"],
    "blacklist": [],
    "maxCostPerRequest": 0.10
  },

  "memory": {
    "enabled": true,
    "path": "~/.switch-ai",
    "retentionDays": 90,
    "maxSize": "1GB",
    "storeContent": false,
    "vacuumInterval": "weekly"
  },

  "learning": {
    "enabled": true,
    "autoBlacklist": true,
    "minSuccessThreshold": 0.3,
    "minSampleSize": 10
  },

  "validation": {
    "enabled": true,
    "escalationRetries": 2,
    "timeoutMs": 30000,
    "maxResponseLength": 50000
  },

  "backends": {
    "litellm": {
      "enabled": true,
      "baseUrl": "http://localhost:8000",
      "timeout": 30000
    },
    "claudeCode": {
      "enabled": true,
      "checkCredits": true
    },
    "gemini": {
      "enabled": true,
      "useFreeTier": true
    },
    "ollama": {
      "enabled": false,
      "baseUrl": "http://localhost:11434"
    }
  }
}
```

---

## Server Configuration

### `server.port`
- **Type**: Number
- **Default**: 4000
- **Description**: Port to listen on for HTTP requests
- **CLI Flag**: `--port <number>`
- **Env Var**: `SWITCH_AI_PORT`

```json
{ "server": { "port": 5000 } }
```

### `server.host`
- **Type**: String
- **Default**: "localhost"
- **Description**: Hostname/IP to bind to
- **Env Var**: `SWITCH_AI_HOST`

```json
{ "server": { "host": "0.0.0.0" } }  // Listen on all interfaces
```

### `server.cors`
- **Type**: Boolean
- **Default**: true
- **Description**: Enable CORS for cross-origin requests
- **Env Var**: `SWITCH_AI_CORS`

### `server.logLevel`
- **Type**: String
- **Options**: "debug", "info", "warn", "error"
- **Default**: "info"
- **Description**: Logging verbosity
- **Env Var**: `SWITCH_AI_LOG_LEVEL`

```json
{ "server": { "logLevel": "debug" } }  // Verbose logging
```

### `server.logFile`
- **Type**: String | null
- **Default**: null (stdout only)
- **Description**: Write logs to file
- **Env Var**: `SWITCH_AI_LOG_FILE`

```json
{ "server": { "logFile": "/var/log/switch-ai.log" } }
```

---

## Model Configuration

### `models.defaultTier`
- **Type**: String
- **Options**: "free", "cheap", "balanced", "premium"
- **Default**: "balanced"
- **Description**: Default tier when task complexity unclear
- **Env Var**: `SWITCH_AI_DEFAULT_TIER`

### `models.preferredModels`
- **Type**: Array[String]
- **Default**: ["sonnet", "haiku"]
- **Description**: Preferred models in order
- **Env Var**: `SWITCH_AI_PREFERRED_MODELS` (comma-separated)

```json
{ "models": { "preferredModels": ["opus", "sonnet"] } }
```

### `models.blacklist`
- **Type**: Array[String]
- **Default**: []
- **Description**: Models to never use
- **Env Var**: `SWITCH_AI_BLACKLIST` (comma-separated)

```json
{ "models": { "blacklist": ["gpt-4", "ollama-mistral"] } }
```

### `models.maxCostPerRequest`
- **Type**: Number (USD)
- **Default**: 0.10
- **Description**: Maximum allowed cost per single request
- **Env Var**: `SWITCH_AI_MAX_COST_PER_REQUEST`

```json
{ "models": { "maxCostPerRequest": 0.05 } }  // 5 cents max
```

### Custom Tier Mapping

Override which models belong to which tier:

```json
{
  "models": {
    "customTiers": {
      "budget": {
        "models": ["haiku", "deepseek"],
        "maxCost": 0.002
      },
      "standard": {
        "models": ["sonnet", "gpt-4-turbo"],
        "maxCost": 0.03
      }
    }
  }
}
```

### Model-Specific Preferences

Set preferences per task category:

```json
{
  "models": {
    "categoryPreferences": {
      "documentation": {
        "preferredModels": ["haiku", "deepseek"],
        "minSuccessThreshold": 0.85
      },
      "architecture": {
        "preferredModels": ["opus", "gpt-4-turbo"],
        "minSuccessThreshold": 0.95,
        "maxCost": 0.20
      }
    }
  }
}
```

---

## Memory Configuration

### `memory.enabled`
- **Type**: Boolean
- **Default**: true
- **Description**: Enable learning memory system

### `memory.path`
- **Type**: String
- **Default**: "~/.switch-ai"
- **Description**: Directory for SQLite database
- **Env Var**: `SWITCH_AI_MEMORY_PATH`

### `memory.retentionDays`
- **Type**: Number
- **Default**: 90
- **Description**: How many days to keep request history
- **Env Var**: `SWITCH_AI_MEMORY_RETENTION`

```json
{ "memory": { "retentionDays": 180 } }  // 6 months
```

### `memory.maxSize`
- **Type**: String (size format)
- **Default**: "1GB"
- **Description**: Maximum database size before warnings
- **Env Var**: `SWITCH_AI_MEMORY_MAX_SIZE`

Options: "100MB", "500MB", "1GB", "5GB"

### `memory.storeContent`
- **Type**: Boolean
- **Default**: false
- **Description**: Store actual request/response text (privacy: use false)
- **Env Var**: `SWITCH_AI_STORE_CONTENT`

```json
{ "memory": { "storeContent": false } }  // Privacy-first (recommended)
```

### `memory.vacuumInterval`
- **Type**: String
- **Options**: "daily", "weekly", "monthly"
- **Default**: "weekly"
- **Description**: How often to vacuum/optimize database

---

## Learning Configuration

### `learning.enabled`
- **Type**: Boolean
- **Default**: true
- **Description**: Enable learning from past requests
- **Env Var**: `SWITCH_AI_LEARNING_ENABLED`

### `learning.autoBlacklist`
- **Type**: Boolean
- **Default**: true
- **Description**: Auto-blacklist models with low success rate
- **Env Var**: `SWITCH_AI_AUTO_BLACKLIST`

### `learning.minSuccessThreshold`
- **Type**: Number (0-1)
- **Default**: 0.3
- **Description**: Blacklist models below this success rate
- **Env Var**: `SWITCH_AI_MIN_SUCCESS_THRESHOLD`

```json
{ "learning": { "minSuccessThreshold": 0.5 } }  // Require 50% success
```

### `learning.minSampleSize`
- **Type**: Number
- **Default**: 10
- **Description**: Require N attempts before blacklisting
- **Env Var**: `SWITCH_AI_MIN_SAMPLE_SIZE`

```json
{ "learning": { "minSampleSize": 20 } }  // Need 20+ attempts to blacklist
```

---

## Validation Configuration

### `validation.enabled`
- **Type**: Boolean
- **Default**: true
- **Description**: Check response quality
- **Env Var**: `SWITCH_AI_VALIDATE_RESPONSES`

### `validation.escalationRetries`
- **Type**: Number
- **Default**: 2
- **Description**: How many times to retry/escalate if validation fails
- **Env Var**: `SWITCH_AI_ESCALATION_RETRIES`

```json
{ "validation": { "escalationRetries": 3 } }
```

### `validation.timeoutMs`
- **Type**: Number (milliseconds)
- **Default**: 30000
- **Description**: Timeout for response from model
- **Env Var**: `SWITCH_AI_TIMEOUT_MS`

### `validation.maxResponseLength`
- **Type**: Number
- **Default**: 50000
- **Description**: Maximum response length before truncation warning
- **Env Var**: `SWITCH_AI_MAX_RESPONSE_LENGTH`

---

## Backend Configuration

### LiteLLM Configuration

```json
{
  "backends": {
    "litellm": {
      "enabled": true,
      "baseUrl": "http://localhost:8000",
      "timeout": 30000,
      "apiKey": "...",  // or use env var LITELLM_API_KEY
      "masterKey": "..."
    }
  }
}
```

### Claude Code Configuration

```json
{
  "backends": {
    "claudeCode": {
      "enabled": true,
      "checkCredits": true,
      "creditCheckInterval": 300000  // 5 minutes
    }
  }
}
```

### Gemini Configuration

```json
{
  "backends": {
    "gemini": {
      "enabled": true,
      "useFreeTier": true,
      "apiKey": "..."  // or use env var GEMINI_API_KEY
    }
  }
}
```

### Ollama Configuration

```json
{
  "backends": {
    "ollama": {
      "enabled": false,
      "baseUrl": "http://localhost:11434",
      "priority": "high",  // Check Ollama first if available
      "models": ["mistral", "neural-chat"]
    }
  }
}
```

---

## Environment Variables

Complete list of environment variables:

### Core Settings

```bash
# Server
SWITCH_AI_PORT=4000
SWITCH_AI_HOST=localhost
SWITCH_AI_LOG_LEVEL=info
SWITCH_AI_LOG_FILE=/path/to/file.log
SWITCH_AI_CORS=true

# Models
SWITCH_AI_DEFAULT_TIER=balanced
SWITCH_AI_PREFERRED_MODELS=sonnet,haiku
SWITCH_AI_BLACKLIST=gpt-4,ollama-mistral
SWITCH_AI_MAX_COST_PER_REQUEST=0.10

# Memory
SWITCH_AI_MEMORY_PATH=~/.switch-ai
SWITCH_AI_MEMORY_RETENTION=90
SWITCH_AI_MEMORY_MAX_SIZE=1GB
SWITCH_AI_STORE_CONTENT=false

# Learning
SWITCH_AI_LEARNING_ENABLED=true
SWITCH_AI_AUTO_BLACKLIST=true
SWITCH_AI_MIN_SUCCESS_THRESHOLD=0.3
SWITCH_AI_MIN_SAMPLE_SIZE=10

# Validation
SWITCH_AI_VALIDATE_RESPONSES=true
SWITCH_AI_ESCALATION_RETRIES=2
SWITCH_AI_TIMEOUT_MS=30000
```

### API Keys

```bash
# Anthropic (for OpenRouter)
ANTHROPIC_API_KEY=sk-ant-...

# OpenRouter (for model access)
OPENROUTER_API_KEY=sk-or-...

# Google Gemini
GEMINI_API_KEY=...

# OpenAI (if using GPT models)
OPENAI_API_KEY=sk-...

# LiteLLM
LITELLM_API_KEY=...
LITELLM_MASTER_KEY=...
```

### Feature Flags

```bash
# Enable/disable learning from experience
SWITCH_AI_LEARNING_ENABLED=true

# Enable/disable response quality validation
SWITCH_AI_VALIDATE_RESPONSES=true

# Enable/disable cost tracking
SWITCH_AI_COST_TRACKING=true

# Enable/disable usage analytics
SWITCH_AI_ANALYTICS=false

# Test mode (log decisions, don't execute)
SWITCH_AI_TEST_MODE=false

# Debug mode (verbose logging)
SWITCH_AI_DEBUG=false
```

---

## Configuration Examples

### Example 1: Cost-Optimized Setup

Focus on saving money:

```json
{
  "models": {
    "defaultTier": "cheap",
    "maxCostPerRequest": 0.001,
    "preferredModels": ["deepseek", "haiku"]
  },
  "learning": {
    "minSuccessThreshold": 0.5  // More tolerance for errors
  }
}
```

### Example 2: Quality-First Setup

Focus on reliability:

```json
{
  "models": {
    "defaultTier": "premium",
    "maxCostPerRequest": 0.30,
    "preferredModels": ["opus", "gpt-4-turbo"]
  },
  "validation": {
    "escalationRetries": 3
  },
  "learning": {
    "minSuccessThreshold": 0.9  // High bar for success
  }
}
```

### Example 3: Team Setup

Shared configuration for team:

```json
{
  "server": {
    "host": "0.0.0.0",  // Listen on all interfaces
    "port": 4000
  },
  "models": {
    "defaultTier": "balanced",
    "maxCostPerRequest": 0.05
  },
  "memory": {
    "retentionDays": 180  // 6 months for team audit
  }
}
```

### Example 4: Development Setup

Optimized for development:

```json
{
  "server": {
    "logLevel": "debug"  // Verbose logging
  },
  "memory": {
    "enabled": false  // Don't learn in dev
  },
  "validation": {
    "enabled": false  // Skip validation for speed
  }
}
```

---

## Using .env File

Create `.env` for sensitive data:

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-...
SWITCH_AI_PORT=4000
SWITCH_AI_LOG_LEVEL=debug
```

Load in your application:

```javascript
import dotenv from 'dotenv';
dotenv.config();

// Environment variables now available
console.log(process.env.ANTHROPIC_API_KEY);
```

**Important**: Add `.env` to `.gitignore`:
```bash
echo ".env" >> .gitignore
echo ".env.*.local" >> .gitignore
```

---

## Validating Configuration

Check if configuration is valid:

```bash
switch-ai config validate

# Output:
# ✓ Configuration valid
# ├─ server.port: 4000
# ├─ models.defaultTier: balanced
# ├─ memory.enabled: true
# ├─ API keys: ✓ Found
# └─ Backends: ✓ All healthy
```

---

## Resetting to Defaults

```bash
# Reset single setting
switch-ai config set defaultTier balanced

# Reset all to defaults
switch-ai config reset --confirm
```

---

## Performance Tuning

### For High-Throughput Scenarios

```json
{
  "server": {
    "port": 4000
  },
  "validation": {
    "enabled": false,  // Skip validation for speed
    "timeoutMs": 10000  // Shorter timeout
  },
  "memory": {
    "vacuumInterval": "monthly"  // Less frequent maintenance
  }
}
```

### For Memory-Constrained Environments

```json
{
  "memory": {
    "maxSize": "100MB",
    "retentionDays": 30,
    "vacuumInterval": "daily"
  },
  "learning": {
    "minSampleSize": 50  // Fewer data points needed
  }
}
```

---

## Security Settings

### Strict Mode

Fail instead of escalating:

```json
{
  "validation": {
    "escalationRetries": 0  // No retries
  }
}
```

### Privacy Mode

Don't store request content:

```json
{
  "memory": {
    "storeContent": false
  }
}
```

### API Key Management

Use environment variables, never hardcode:

```bash
# ✅ Good
ANTHROPIC_API_KEY=sk-ant-... node app.js

# ❌ Bad - don't do this
```

---

## Troubleshooting Configuration

### "Config file not found"

```bash
# Create default config
switch-ai config list  # This auto-creates if missing
```

### "Invalid tier value"

```bash
# Tier must be one of: free, cheap, balanced, premium
switch-ai config set defaultTier balanced
```

### "Port already in use"

```bash
# Change port in config
switch-ai config set server.port 5000

# Or via env var
SWITCH_AI_PORT=5000 switch-ai start
```

---

## Next Steps

- Review [INSTALLATION.md](INSTALLATION.md) for setup
- Check [CLI-REFERENCE.md](CLI-REFERENCE.md) for commands
- Read [DECISION-ENGINE.md](DECISION-ENGINE.md) for how selections work
