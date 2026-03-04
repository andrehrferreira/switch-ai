# CLI Reference

Complete reference for all Switch AI command-line commands.

---

## Global Flags

These flags work with all commands:

```bash
-h, --help           Show help message
-V, --version        Show version number
-v, --verbose        Enable verbose logging
-q, --quiet          Suppress non-error output
--debug              Enable debug mode with detailed logging
--config <path>      Use custom config file (default: ~/.switch-ai/config.json)
```

---

## Quick Start Commands

### `switch-ai claude`

Start Switch AI proxy + set env vars + launch Claude Code CLI in one command.

```bash
switch-ai claude [options]

Options:
  --model <name>      Use specific model (default: auto)
  --port <number>     Proxy port (default: 4000)
  --no-proxy          Don't start proxy, just launch Claude
  --new-window        Open Claude in new terminal window
  --with-keys         Prompt to add API keys first

Examples:
  # Simple: start proxy + launch Claude
  switch-ai claude

  # Launch with keys setup first
  switch-ai claude --with-keys

  # Use specific model
  switch-ai claude --model opus

  # Just launch Claude (proxy already running)
  switch-ai claude --no-proxy

  # Open Claude in new terminal window
  switch-ai claude --new-window
```

**Output**:
```
✓ Switch AI proxy started (PID: 12345)
  Port: http://localhost:4000

✓ Environment configured:
  ANTHROPIC_BASE_URL=http://localhost:4000
  ANTHROPIC_API_KEY=sk-ant-***

✓ Launching Claude Code...
  Your Claude CLI will now use Switch AI routing!

  Type: claude --help
  Then: claude "your prompt"
```

**How it works**:
1. Starts Switch AI proxy on localhost:4000
2. Exports `ANTHROPIC_BASE_URL=http://localhost:4000` to current shell
3. Launches `claude` command with routing enabled
4. All your Claude requests now go through Switch AI's intelligent routing

---

## Core Commands

### `switch-ai start`

Start the Switch AI proxy server on localhost:4000.

```bash
switch-ai start [options]

Options:
  --port <number>       Override default port (default: 4000)
  --host <hostname>     Bind to specific hostname (default: localhost)
  --daemon              Run in background (returns PID)
  --no-learn            Disable learning (don't update memory)
  --strict              Strict mode - fail instead of escalating
  --debug               Enable debug logging
  --log-file <path>     Write logs to file
  --max-concurrent <n>  Max concurrent requests (default: 10)

Examples:
  # Start on default port
  switch-ai start

  # Start on custom port
  switch-ai start --port 5000

  # Start in background
  switch-ai start --daemon

  # Start with debug logging
  switch-ai start --debug

  # Start in strict mode (no escalation)
  switch-ai start --strict
```

**Output**:
```
✓ Switch AI proxy started
  URL: http://localhost:4000/v1
  Config: ~/.switch-ai/config.json
  Memory: ~/.switch-ai/memory.db
  PID: 12345

Set environment variable:
  export ANTHROPIC_BASE_URL=http://localhost:4000
```

---

### `switch-ai stop`

Stop the running Switch AI proxy server.

```bash
switch-ai stop [options]

Options:
  --pid <number>       Stop specific PID (auto-detected if not provided)
  --force              Force kill (use if graceful stop hangs)
  --timeout <ms>       Wait time before force kill (default: 5000)

Examples:
  # Stop the server
  switch-ai stop

  # Force kill
  switch-ai stop --force

  # Stop specific PID
  switch-ai stop --pid 12345
```

**Output**:
```
✓ Switch AI proxy stopped (PID: 12345)
  Graceful shutdown completed
  All pending requests finished
```

---

### `switch-ai status`

Check if Switch AI is running and show current status.

```bash
switch-ai status [options]

Options:
  --json               Output as JSON
  --detailed           Show detailed info

Examples:
  # Check status
  switch-ai status

  # JSON output
  switch-ai status --json

  # Detailed info
  switch-ai status --detailed
```

**Output**:
```
✓ Switch AI is running
  PID: 12345
  Port: 4000
  Uptime: 2h 45m
  Requests: 342
  Avg latency: 450ms
  Avg cost: $0.003

  Backend Status:
  ├─ LiteLLM: ✓ Connected
  ├─ Claude Code: ✓ Available (50 credits remaining)
  ├─ Gemini CLI: ✓ Available
  └─ Ollama: ✗ Not running
```

---

## Configuration Commands

### `switch-ai config`

View and modify configuration.

```bash
switch-ai config [options] [key] [value]

Subcommands:
  switch-ai config get <key>         Get config value
  switch-ai config set <key> <value> Set config value
  switch-ai config list              List all config
  switch-ai config reset             Reset to defaults
  switch-ai config validate          Validate config file

Examples:
  # Get single value
  switch-ai config get defaultTier

  # Set value
  switch-ai config set defaultTier balanced

  # List all config
  switch-ai config list

  # Reset to defaults
  switch-ai config reset

  # Validate config
  switch-ai config validate
```

**Common Config Keys**:
- `defaultTier` - free, cheap, balanced, or premium
- `maxCostPerRequest` - Number (USD)
- `memory.retentionDays` - Number
- `modelPreferences.documentation` - Model name
- `validateResponses` - true/false
- `escalationRetries` - Number

**Output**:
```
DefaultTier: balanced
MaxCostPerRequest: 0.10
ValidateResponses: true
EscalationRetries: 2

Models Available:
├─ haiku (cheap)
├─ deepseek (cheap)
├─ sonnet (balanced)
└─ opus (premium)
```

---

## Key Management Commands

### `switch-ai keys`

Manage API keys securely.

```bash
switch-ai keys <subcommand> [options]

Subcommands:
  keys set <provider> [key]      Add/update API key
  keys get <provider>            Get key (masked)
  keys list                       List all keys (masked)
  keys remove <provider>         Delete key
  keys export [file]             Export to .env file
  keys import <file>             Import from .env file
  keys validate                  Validate all keys work

Options:
  --interactive                  Prompt for key (secure input)
  --no-mask                      Show full keys (dangerous!)
  --backup                       Backup existing keys first

Providers:
  - anthropic       Anthropic API key
  - openrouter      OpenRouter API key
  - gemini          Google Gemini API key
  - openai          OpenAI API key
  - ollama          Ollama local endpoint

Examples:
  # Add key interactively (secure)
  switch-ai keys set openrouter
  # Prompts: Enter OpenRouter API key: ••••••••••••

  # Add key from command line
  switch-ai keys set openrouter sk-or-...
  switch-ai keys set anthropic sk-ant-...

  # View all keys (masked)
  switch-ai keys list
  # Output:
  # ├─ anthropic: sk-ant-***...
  # ├─ openrouter: sk-or-***...
  # └─ gemini: AIzaSy***...

  # Export to .env file
  switch-ai keys export > .env

  # Import from .env file
  switch-ai keys import .env.backup

  # Remove key
  switch-ai keys remove openrouter

  # Validate all keys
  switch-ai keys validate
  # Output:
  # ├─ anthropic: ✓ Valid
  # ├─ openrouter: ✓ Valid
  # └─ gemini: ✗ Invalid or expired
```

**Security Notes**:
- Keys stored in `~/.switch-ai/keys.enc` (encrypted)
- Never displayed in full (masked with ***)
- Use `--interactive` mode for secure input
- Export .env should be added to `.gitignore`

---

## Model Commands

### `switch-ai models`

List available models and their status.

```bash
switch-ai models [options]

Options:
  --tier <name>        Filter by tier (free, cheap, balanced, premium)
  --with-stats         Include performance statistics
  --with-pricing       Show current pricing from OpenRouter
  --blacklisted        Show only blacklisted models
  --json               Output as JSON

Examples:
  # List all models
  switch-ai models

  # Show models with stats
  switch-ai models --with-stats

  # Show blacklisted models
  switch-ai models --blacklisted

  # Filter by tier
  switch-ai models --tier cheap --with-pricing
```

**Output**:
```
Free Tier (0/request):
├─ claude-code        ✓ Available (50 credits)
├─ gemini-free        ✓ Available
└─ ollama-mistral     ✗ Not installed

Cheap Tier ($0.001/req):
├─ haiku              ✓ Online | 98% success | avg $0.001
├─ deepseek           ✓ Online | 88% success | avg $0.0008
└─ gemini-2.0-flash   ✓ Online | 85% success | avg $0.002

Balanced Tier ($0.01-0.03/req):
├─ sonnet             ✓ Online | 94% success | avg $0.015
└─ gpt-4-turbo        ✓ Online | 92% success | avg $0.025

Premium Tier ($0.05-0.30/req):
├─ opus               ✓ Online | 99% success | avg $0.075
└─ gpt-4o             ✓ Online | 98% success | avg $0.015

Blacklisted:
├─ deepseek (until 2024-03-05 10:00)
```

---

### `switch-ai models setup`

Auto-setup missing models/dependencies.

```bash
switch-ai models setup [options]

Options:
  --all              Install all recommended models
  --tier <name>      Install models for specific tier
  --interactive      Ask for each model
  --skip-confirm     Don't ask for confirmation

Examples:
  # Interactive setup
  switch-ai models setup --interactive

  # Install cheap tier models
  switch-ai models setup --tier cheap

  # Install all
  switch-ai models setup --all --skip-confirm
```

**Output**:
```
Setting up models...

Checking Ollama: Not installed
  $ brew install ollama (macOS)
  $ curl https://ollama.ai/install.sh | sh (Linux)

Checking Gemini CLI: Not installed
  $ npm install -g @google/generative-ai

Installing recommended models...
├─ ✓ haiku (already available via OpenRouter)
├─ Installing ollama/mistral...
│  $ ollama pull mistral
│  ▓▓▓▓▓░░░░░░░░░░░░░░░░░ 45%
└─ ✓ Complete

Setup complete! Run: switch-ai start
```

---

## History & Analytics Commands

### `switch-ai history`

View request history and analytics.

```bash
switch-ai history [options]

Options:
  --limit <number>          Limit results (default: 100)
  --since <time>            Show requests since time (e.g., "1h", "1d")
  --until <time>            Show requests until time
  --model <name>            Filter by model
  --category <name>         Filter by category
  --status <status>         Filter by status (success, failure, timeout)
  --escalated               Show only escalated requests
  --format <type>           output format (table, json, csv)
  --summary                 Show summary statistics
  --group-by <field>        Group by field (model, category, date)
  --cost-analysis           Show cost breakdown

Examples:
  # Show last 50 requests
  switch-ai history --limit 50

  # Show requests from last 24 hours
  switch-ai history --since 24h

  # Filter by model
  switch-ai history --model haiku

  # Show escalated requests
  switch-ai history --escalated

  # Cost analysis
  switch-ai history --cost-analysis
```

**Output**:
```
Recent Requests (last 50):

Timestamp          Category    Model    Status      Latency  Cost
2024-03-04 10:45  documentation  haiku  ✓ success   340ms    $0.001
2024-03-04 10:44  code       sonnet   ✓ success   520ms    $0.015
2024-03-04 10:43  tests      deepseek ✓ success   290ms    $0.0008
2024-03-04 10:42  code       haiku    ✗ failed → ↗ sonnet  450ms    $0.015

Summary:
├─ Total requests: 342
├─ Success rate: 96.5%
├─ Avg latency: 415ms
├─ Total cost: $4.32
├─ Avg cost: $0.0126
└─ Escalation rate: 3.5% (12 escalations)
```

---

### `switch-ai analyze`

Detailed analysis of model performance.

```bash
switch-ai analyze [options]

Options:
  --model <name>     Analyze specific model
  --category <name>  Analyze specific category
  --period <time>    Analyze time period
  --format <type>    output format (table, json, chart)

Examples:
  # Analyze all models
  switch-ai analyze

  # Analyze specific model
  switch-ai analyze --model haiku

  # Analyze code category
  switch-ai analyze --category code

  # Last 7 days
  switch-ai analyze --period 7d
```

**Output**:
```
Model Performance Analysis:

Haiku (last 100 requests):
├─ Success rate: 98%
├─ Avg latency: 350ms
├─ Avg cost: $0.001
├─ By category:
│  ├─ documentation: 100% (45/45)
│  ├─ tests: 96% (21/22)
│  ├─ code: 94% (30/32)
│  └─ architecture: 0% (0/5) ✗

Sonnet (last 100 requests):
├─ Success rate: 94%
├─ Avg latency: 520ms
├─ Avg cost: $0.015
├─ By category:
│  ├─ code: 96% (25/26)
│  ├─ research: 92% (12/13)
│  └─ architecture: 88% (7/8)

Cost Comparison:
├─ Haiku: 0.1 cost per success
├─ Sonnet: 0.016 cost per success
├─ Recommendation: Haiku for docs/tests/code, Sonnet for complex
```

---

## Memory Commands

### `switch-ai memory`

Manage learning memory database.

```bash
switch-ai memory <subcommand> [options]

Subcommands:
  memory export           Export memory to JSON
  memory import <file>    Import memory from JSON
  memory clear            Clear all data
  memory cleanup          Delete old entries
  memory stats            Show database statistics
  memory optimize         Vacuum and reindex

Examples:
  # Export memory
  switch-ai memory export > backup.json

  # Import from backup
  switch-ai memory import backup.json

  # Clear all data
  switch-ai memory clear --confirm

  # Cleanup old data (>90 days)
  switch-ai memory cleanup --older-than 90

  # Show stats
  switch-ai memory stats
```

**Output (stats)**:
```
Memory Database Statistics:

File Location: ~/.switch-ai/memory.db
File Size: 42 MB
Last Updated: 2024-03-04 10:45

Data:
├─ Requests: 5,234
│  ├─ Successful: 5,045 (96.4%)
│  ├─ Failed: 189 (3.6%)
│  └─ Escalated: 180 (3.4%)
├─ Model Performance: 42 rows
├─ Failure Patterns: 23 active
└─ Cost Tracking: 4 months

Space Usage:
├─ Requests table: 25 MB
├─ Model performance: 1 MB
├─ Failure patterns: 0.5 MB
└─ Indexes: 15.5 MB

Cleanup Potential: 5 MB (entries > 90 days old)
```

---

### `switch-ai reset-memory`

Clear all learning memory (dangerous!).

```bash
switch-ai reset-memory [options]

Options:
  --confirm          Required flag to confirm deletion
  --keep-costs       Keep cost analysis but clear request details
  --backup           Create backup before deleting

Examples:
  # Reset memory (with confirmation)
  switch-ai reset-memory --confirm

  # Reset with backup
  switch-ai reset-memory --confirm --backup

  # Keep cost data, clear request details
  switch-ai reset-memory --confirm --keep-costs
```

**Output**:
```
⚠️  WARNING: This will delete all request history and learning data

Requests to delete: 5,234
This cannot be undone.

✓ Backup created: ~/.switch-ai/memory_backup_2024-03-04.json

✓ Memory cleared successfully
  All learning data deleted
  Model ratings reset to defaults
```

---

## Maintenance Commands

### `switch-ai maintenance`

Database and system maintenance.

```bash
switch-ai maintenance [options]

Options:
  --cleanup          Delete old entries
  --older-than <n>   Days of data to keep (default: 90)
  --vacuum           Optimize database
  --reindex          Rebuild indexes
  --analyze          Analyze query performance
  --full             Run all maintenance tasks

Examples:
  # Full maintenance
  switch-ai maintenance --full

  # Clean old data
  switch-ai maintenance --cleanup --older-than 180

  # Optimize database
  switch-ai maintenance --vacuum

  # Analyze performance
  switch-ai maintenance --analyze
```

---

## Development Commands

### `switch-ai dev`

Start server in development mode with hot-reload.

```bash
switch-ai dev [options]

Options:
  --watch           Watch for file changes and restart
  --inspect         Enable Node.js inspector
  --inspect-brk     Break on startup for debugging

Examples:
  # Development mode
  switch-ai dev

  # With debugger
  switch-ai dev --inspect
```

---

### `switch-ai test`

Run test suite.

```bash
switch-ai test [options]

Options:
  --watch           Re-run on file changes
  --coverage        Generate coverage report
  --verbose         Verbose output

Examples:
  # Run tests
  switch-ai test

  # Watch mode
  switch-ai test --watch

  # With coverage
  switch-ai test --coverage
```

---

## Documentation Commands

### `switch-ai docs`

Access documentation.

```bash
switch-ai docs [topic]

Topics:
  architecture       System architecture overview
  decision-engine    Decision making algorithm
  model-tiers        Model tier definitions
  memory             Memory system documentation
  faq                Frequently asked questions
  examples           Usage examples

Examples:
  # Show architecture docs
  switch-ai docs architecture

  # List all topics
  switch-ai docs list

  # Open in browser
  switch-ai docs architecture --browser
```

---

## Help & Information

### `switch-ai help`

Show help message.

```bash
switch-ai help [command]

Examples:
  # General help
  switch-ai help

  # Help for specific command
  switch-ai help start

  # List all commands
  switch-ai help --all
```

---

### `switch-ai version`

Show version information.

```bash
switch-ai version [options]

Options:
  --json             Output as JSON
  --check            Check for updates

Examples:
  # Show version
  switch-ai version

  # Check for updates
  switch-ai version --check
```

**Output**:
```
Switch AI v0.1.0
Node.js: v18.17.0
Platform: darwin (macOS)
Architecture: arm64
Commit: abc123def456
```

---

## Environment Setup

### Set ANTHROPIC_BASE_URL

After starting the server, set environment variable in your shell:

```bash
# Bash / Zsh
export ANTHROPIC_BASE_URL=http://localhost:4000

# PowerShell
$env:ANTHROPIC_BASE_URL = "http://localhost:4000"

# Windows CMD
set ANTHROPIC_BASE_URL=http://localhost:4000
```

Or add to your `.env` file:

```bash
# .env
ANTHROPIC_BASE_URL=http://localhost:4000
ANTHROPIC_API_KEY=sk-ant-...  # Your actual key
```

---

## Examples

### Example 1: Complete Setup

```bash
# Install globally
npm install -g switch-ai

# Setup models
switch-ai models setup --interactive

# Configure
switch-ai config set defaultTier balanced

# Start server
switch-ai start

# In another terminal:
export ANTHROPIC_BASE_URL=http://localhost:4000

# Use normally with ANTHROPIC SDK
# or curl:
curl http://localhost:4000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANTHROPIC_API_KEY" \
  -d '{"model":"auto","messages":[...]}'
```

### Example 2: Analyze Costs

```bash
# View cost summary
switch-ai history --cost-analysis

# Get detailed breakdown
switch-ai analyze --period 7d

# Export for spreadsheet
switch-ai history --format csv > requests.csv
```

### Example 3: Troubleshooting

```bash
# Check status
switch-ai status --detailed

# View recent errors
switch-ai history --status failure --limit 20

# Check model health
switch-ai models --with-stats

# View debug logs
switch-ai status --debug
```
