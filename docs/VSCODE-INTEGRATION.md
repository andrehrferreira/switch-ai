# VSCode Claude Code Integration

Use Switch AI directly within the Claude Code VSCode extension.

---

## Setup

### 1. Install Claude Code Extension

Install the official Claude Code extension for VSCode:
- Search "Claude Code" in VSCode Extensions
- Or install via: `code --install-extension anthropic.claude-code`

### 2. Install Switch AI

```bash
npm install -g switch-ai
```

### 3. Configure VSCode Extension

Open VSCode settings (`Cmd/Ctrl + ,`) and add:

```json
{
  "claude.baseURL": "http://localhost:4000/v1",
  "claude.apiKey": "${ANTHROPIC_API_KEY}"
}
```

Or in `.vscode/settings.json`:

```json
{
  "claude.baseURL": "http://localhost:4000/v1"
}
```

### 4. Start Switch AI

```bash
# Start proxy server in background
switch-ai start --daemon

# Or in a separate terminal
switch-ai start
```

---

## Usage in VSCode

### Method 1: Use Chat Extension

1. Open VSCode
2. Click "Claude Code" icon in sidebar
3. Click "Start Chat" or "Ask Claude"
4. Type your prompt normally
5. **Switch AI automatically routes** - no changes needed!

### Method 2: Use Command Palette

```
Cmd/Ctrl + Shift + P → "Claude Code: Chat"
```

Then type your prompt. Switch AI handles routing behind the scenes.

### Method 3: Quick Setup (One Command)

If you want to setup everything automatically from VSCode terminal:

```bash
# Terminal in VSCode
switch-ai setup --vscode

# This will:
# 1. Start proxy (daemon mode)
# 2. Export ANTHROPIC_BASE_URL
# 3. Configure VSCode settings
# 4. Show setup complete message
```

---

## Workflow Examples

### Example 1: Document This Code

1. Open a code file
2. Select some code
3. Press `Cmd/Ctrl + K` (or use Chat)
4. Type: "Add JSDoc comments to this code"
5. Claude (via Switch AI) responds
   - **Route**: Haiku (simple task, cheap tier)
   - **Cost**: ~$0.001
   - **Latency**: ~500ms

### Example 2: Debug Complex Issue

1. Open VSCode terminal
2. Run `switch-ai claude`
   - This launches Claude CLI in terminal
   - Proxy already connected from VSCode
3. Type: `claude "Why is this async function timing out? [paste code]"`
4. Claude (via Switch AI) responds
   - **Route**: Sonnet or Opus (complex debugging)
   - **Cost**: ~$0.01-0.15
   - **Decision**: Based on complexity analysis

### Example 3: Architecture Discussion

1. In VSCode Chat, ask: "Design a microservices architecture for..."
2. Claude (via Switch AI) analyzes complexity
   - Very high complexity detected (architecture task)
   - **Route**: Opus (premium tier)
   - **Cost**: ~$0.10
   - **Confidence**: 99%

---

## Configuration Files

### VSCode Settings

Create `.vscode/settings.json` in your workspace:

```json
{
  "claude.baseURL": "http://localhost:4000/v1",
  "claude.apiKey": "${ANTHROPIC_API_KEY}",
  "claude.defaultModel": "auto",
  "claude.temperature": 0.7,
  "claude.maxTokens": 2048
}
```

### .env File for Project

Create `.env` in your project root:

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-...
ANTHROPIC_BASE_URL=http://localhost:4000/v1
```

Add to `.gitignore`:
```bash
.env
.env.local
```

---

## Automation Scripts

### Auto-Start Script

Create `scripts/start-dev.sh`:

```bash
#!/bin/bash
# Start Switch AI + VSCode with Claude Code

# Start Switch AI in background
switch-ai start --daemon --port 4000

# Start VSCode
code .

# Show instructions
echo "✓ Switch AI running on localhost:4000"
echo "✓ VSCode Claude Code will use Switch AI routing"
```

Make executable:
```bash
chmod +x scripts/start-dev.sh
```

Run:
```bash
./scripts/start-dev.sh
```

### npm Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "switch-ai:start": "switch-ai start --daemon",
    "switch-ai:stop": "switch-ai stop",
    "switch-ai:setup": "switch-ai keys set openrouter && switch-ai start --daemon",
    "dev": "npm run switch-ai:start && code ."
  }
}
```

Then:
```bash
npm run dev          # Start Switch AI + VSCode
npm run switch-ai:setup  # Setup keys + start
npm run switch-ai:stop   # Stop server
```

---

## Keybindings

Add custom keybindings for Claude Code in VSCode:

Open `keybindings.json` (`Cmd/Ctrl + Shift + P` → "Open Keyboard Shortcuts JSON"):

```json
[
  {
    "key": "cmd+shift+l",
    "command": "claude.chat"
  },
  {
    "key": "cmd+shift+d",
    "command": "claude.document"
  },
  {
    "key": "cmd+shift+t",
    "command": "claude.test"
  }
]
```

---

## Workspace Setup

### Structure

```
my-project/
├── .vscode/
│   └── settings.json       # VSCode settings with Switch AI config
├── .env                    # API keys (in .gitignore)
├── .env.example            # Template for contributors
├── scripts/
│   └── start-dev.sh        # Auto-start script
├── package.json
└── src/
```

### .vscode/settings.json Template

```json
{
  "// Claude Code + Switch AI": "Auto-route requests through intelligent model selector",
  "claude.baseURL": "http://localhost:4000/v1",
  "claude.apiKey": "${ANTHROPIC_API_KEY}",
  "claude.defaultModel": "auto",

  "// Editor Settings": "",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",

  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

---

## Troubleshooting

### VSCode can't reach Switch AI proxy

```bash
# Check if proxy is running
switch-ai status

# If not running, start it
switch-ai start

# Check port
lsof -i :4000  # macOS/Linux
netstat -ano | findstr :4000  # Windows
```

### "ANTHROPIC_API_KEY not found"

```bash
# Check if env var is set
echo $ANTHROPIC_API_KEY

# If empty, set it
export ANTHROPIC_API_KEY=sk-ant-...

# Or add to .env in your project
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
```

### Models not showing up

```bash
# Refresh model list
switch-ai models

# Validate config
switch-ai config validate

# Check API keys
switch-ai keys list
```

### Slow responses

```bash
# Check status
switch-ai status --detailed

# View latency metrics
switch-ai history --summary

# Check proxy is running locally (should be fast)
curl http://localhost:4000/health
```

---

## Advanced: Custom Model Selection

Override model selection for specific tasks:

### Using Model Comments

In your code, add comments to hint at model complexity:

```typescript
// Model: haiku
// Simple utility function
export function formatDate(date: Date): string {
  return date.toISOString();
}

// Model: sonnet
// Complex algorithm with edge cases
export function distributeCache(items: Item[]): CacheNode[] {
  // Ask Claude to optimize this
}

// Model: opus
// Critical business logic - needs best quality
export function calculateRevenue(orders: Order[]): number {
  // Ask Claude to review this carefully
}
```

### Programmatic Control

If you have a custom setup, you can override:

```javascript
// In your project config
const switchAI = {
  baseURL: "http://localhost:4000/v1",
  modelHints: {
    "src/utils/**": "haiku",        // Utils use cheap model
    "src/core/**": "opus",          // Core use premium
    "src/tests/**": "cheap"         // Tests use cheap
  }
};
```

---

## Monitor Usage from VSCode

### Check Costs in Real-time

Open VSCode terminal:

```bash
# Watch history in real-time
watch -n 1 'switch-ai history --limit 5 --format table'

# Or one-time check
switch-ai history --cost-analysis
```

### VSCode Status Bar Extension

Add custom status bar to show Switch AI status:

Create `.vscode/extensions.json`:

```json
{
  "recommendations": [
    "anthropic.claude-code",
    "ms-vscode.makefile-tools"
  ]
}
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Setup Switch AI
on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install Switch AI
        run: npm install -g switch-ai

      - name: Configure keys
        run: |
          switch-ai keys set openrouter ${{ secrets.OPENROUTER_KEY }}
          switch-ai keys set anthropic ${{ secrets.ANTHROPIC_KEY }}

      - name: Start Switch AI
        run: switch-ai start --daemon

      - name: Run tests
        run: npm test
        env:
          ANTHROPIC_BASE_URL: http://localhost:4000/v1
```

---

## Conclusion

You now have:
- ✅ VSCode Claude Code extension working
- ✅ Switch AI proxy routing requests intelligently
- ✅ Automatic model selection based on task complexity
- ✅ Cost optimization across all tasks
- ✅ Full integration with your development workflow

For more info, see:
- [CLI-REFERENCE.md](CLI-REFERENCE.md) - All commands
- [CONFIGURATION.md](CONFIGURATION.md) - Configuration options
- [README.md](../README.md) - Overview
