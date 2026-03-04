# Installation Guide

Complete instructions for installing and setting up Switch AI.

---

## System Requirements

**Minimum**:
- Node.js >= 18.0.0
- npm >= 9.0.0 or yarn >= 3.0.0
- 500 MB disk space
- Internet connection (for OpenRouter API calls)

**Supported Platforms**:
- ✅ macOS (Intel & Apple Silicon)
- ✅ Linux (Ubuntu, Debian, Fedora, etc.)
- ✅ Windows (10/11 with WSL2 or native Node.js)

**Recommended**:
- Node.js >= 20 LTS
- 2+ GB RAM
- SSD for better performance
- Stable internet connection

---

## Installation Methods

### Method 1: Global NPM Install (Recommended)

Install globally so `switch-ai` command is available everywhere.

```bash
# Install globally
npm install -g switch-ai

# Verify installation
switch-ai --version
# Output: Switch AI v0.1.0
```

**Pros**:
- ✅ Simple one-liner
- ✅ Available from any directory
- ✅ Easy to update

**Cons**:
- Requires npm access (admin on Windows)

---

### Method 2: Local Project Install

Install within a specific project.

```bash
# Initialize Node project (if needed)
npm init -y

# Install as dependency
npm install switch-ai

# Use via npx
npx switch-ai --version

# Or add to scripts in package.json
```

**package.json**:
```json
{
  "scripts": {
    "switch-ai:start": "switch-ai start",
    "switch-ai:stop": "switch-ai stop"
  },
  "dependencies": {
    "switch-ai": "^0.1.0"
  }
}
```

Run with:
```bash
npm run switch-ai:start
```

**Pros**:
- ✅ Per-project configuration
- ✅ No global installation needed

**Cons**:
- More setup required per project

---

### Method 3: Direct NPX (No Installation)

Run directly without installing.

```bash
# Start server directly
npx switch-ai start

# Run commands
npx switch-ai status
npx switch-ai models
```

**Pros**:
- ✅ Always latest version
- ✅ No disk space for installation

**Cons**:
- Slower first run (downloads package)
- Download every time if not cached

---

## Setup & Configuration

After installation, follow these steps:

### Step 1: Initialize Configuration

```bash
# Create default config
switch-ai config list
# This creates ~/.switch-ai/config.json with defaults
```

### Step 2: Setup Models

Auto-detect and setup available models:

```bash
# Interactive setup
switch-ai models setup --interactive

# Or automatic setup of recommended models
switch-ai models setup --tier cheap
```

This will:
- ✓ Detect Claude Code CLI (if installed)
- ✓ Detect Gemini CLI (if installed)
- ✓ Check for Ollama (if installed)
- ✓ Verify OpenRouter API access
- ✓ Test connectivity to all backends

### Step 3: Set API Keys

Switch AI needs at least one API key. Set environment variables:

```bash
# Create .env file
cat > .env << EOF
# Anthropic (required for OpenRouter)
ANTHROPIC_API_KEY=sk-ant-...

# OpenRouter (for multiple models)
OPENROUTER_API_KEY=sk-or-...

# Optional: Gemini, OpenAI, etc.
GEMINI_API_KEY=...
OPENAI_API_KEY=...
EOF

# Load env vars
source .env  # macOS/Linux
# or
set -a; source .env; set +a  # Bash safe way
```

**On Windows**:
```powershell
# PowerShell
$env:ANTHROPIC_API_KEY = "sk-ant-..."
$env:OPENROUTER_API_KEY = "sk-or-..."

# Or create .env and use dotenv package
```

### Step 4: Start Server

```bash
# Start on default port (4000)
switch-ai start

# Start on custom port
switch-ai start --port 5000

# Start in background
switch-ai start --daemon
```

**Output**:
```
✓ Switch AI proxy started
  URL: http://localhost:4000/v1
  Config: ~/.switch-ai/config.json
  Memory: ~/.switch-ai/memory.db

Set environment variable:
  export ANTHROPIC_BASE_URL=http://localhost:4000
```

### Step 5: Verify Installation

```bash
# In another terminal, check status
switch-ai status

# Test with a request
curl http://localhost:4000/v1/health
# Should return: {"status": "ok"}
```

### Step 6: Configure Your Application

Point your ANTHROPIC client to the proxy:

**Node.js**:
```javascript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  baseURL: "http://localhost:4000/v1",
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Use normally - Switch AI handles routing!
const message = await client.messages.create({
  model: "auto",  // Special value: auto-select
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello!" }],
});
```

**Python**:
```python
import anthropic
import os

os.environ["ANTHROPIC_BASE_URL"] = "http://localhost:4000"

client = anthropic.Anthropic(
    api_key=os.environ.get("ANTHROPIC_API_KEY")
)

# Use normally - Switch AI handles routing!
message = client.messages.create(
    model="auto",  # Special value: auto-select
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello!"}],
)
```

**cURL**:
```bash
curl http://localhost:4000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANTHROPIC_API_KEY" \
  -d '{
    "model": "auto",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

---

## Configuration Files

### Main Config: `~/.switch-ai/config.json`

Created automatically on first run. Example:

```json
{
  "version": "0.1.0",

  "server": {
    "port": 4000,
    "host": "localhost",
    "cors": true
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
    "maxSize": "1GB"
  },

  "learning": {
    "enabled": true,
    "autoBlacklist": true,
    "minSuccessThreshold": 0.3
  },

  "validation": {
    "enabled": true,
    "escalationRetries": 2,
    "timeoutMs": 30000
  }
}
```

See [CONFIGURATION.md](CONFIGURATION.md) for all options.

### Environment File: `.env`

Optional file for API keys (not version controlled).

```bash
# API Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-...
GEMINI_API_KEY=...

# Server
SWITCH_AI_PORT=4000
SWITCH_AI_LOG_LEVEL=info

# Features
SWITCH_AI_LEARNING_ENABLED=true
SWITCH_AI_VALIDATE_RESPONSES=true
```

**Important**: Add `.env` to `.gitignore`:
```bash
echo ".env" >> .gitignore
```

---

## Troubleshooting Installation

### Port Already in Use

If port 4000 is busy:

```bash
# Find what's using port 4000
lsof -i :4000  # macOS/Linux
netstat -ano | findstr :4000  # Windows

# Use different port
switch-ai start --port 5000
```

### Permission Denied (npm global install)

On macOS/Linux:

```bash
# Option 1: Use sudo
sudo npm install -g switch-ai

# Option 2: Fix npm permissions (recommended)
# https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally

# Option 3: Use nvm
curl https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
npm install -g switch-ai
```

### Node.js Version Too Old

Check your Node version:

```bash
node --version
# Minimum: v18.0.0

# If too old, upgrade:
# macOS: brew upgrade node
# Linux: apt-get install nodejs
# Windows: https://nodejs.org/

# Or use nvm (Node Version Manager)
nvm install 18
nvm use 18
```

### API Keys Not Found

```bash
# Check if env vars are set
echo $ANTHROPIC_API_KEY

# If empty, set them:
export ANTHROPIC_API_KEY=sk-ant-...

# Or add to ~/.bashrc or ~/.zshrc:
echo 'export ANTHROPIC_API_KEY=sk-ant-...' >> ~/.bashrc
source ~/.bashrc
```

### Cannot Connect to Backend

```bash
# Check OpenRouter connectivity
curl https://openrouter.ai/api/v1/models

# Check if API key is valid
curl https://openrouter.ai/api/v1/auth/key \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"

# Check if local models are available
ollama list
which claude
which gemini
```

---

## Post-Installation

### 1. Set Shell Alias (Optional)

Add shorthand for starting:

```bash
# Add to ~/.bashrc or ~/.zshrc:
alias switchai="switch-ai start"
alias switchai-stop="switch-ai stop"
alias switchai-status="switch-ai status"

# Reload shell
source ~/.bashrc
```

### 2. Create Systemd Service (Linux)

For auto-start on system boot:

```bash
# Create service file
sudo tee /etc/systemd/system/switch-ai.service > /dev/null << EOF
[Unit]
Description=Switch AI Model Proxy
After=network.target

[Service]
Type=simple
User=$USER
ExecStart=$(which switch-ai) start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl enable switch-ai
sudo systemctl start switch-ai

# Check status
sudo systemctl status switch-ai
```

### 3. Create LaunchAgent (macOS)

For auto-start on login:

```bash
# Create plist file
tee ~/Library/LaunchAgents/com.switchai.plist > /dev/null << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.switchai</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/switch-ai</string>
        <string>start</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardErrorPath</key>
    <string>/tmp/switchai.err</string>
    <key>StandardOutPath</key>
    <string>/tmp/switchai.out</string>
</dict>
</plist>
EOF

# Load and start
launchctl load ~/Library/LaunchAgents/com.switchai.plist
launchctl start com.switchai
```

### 4. Update Regularly

Keep Switch AI updated:

```bash
# Check for updates
switch-ai version --check

# Update
npm update -g switch-ai

# Or reinstall latest
npm install -g switch-ai@latest
```

---

## Uninstallation

```bash
# Remove global install
npm uninstall -g switch-ai

# Or local install
npm uninstall switch-ai

# Clean config and memory (optional)
rm -rf ~/.switch-ai
```

**Note**: Removing `~/.switch-ai` deletes all learning history. Create a backup first if needed:

```bash
switch-ai memory export > memory_backup.json
rm -rf ~/.switch-ai
```

---

## Next Steps

After installation:

1. **Read the README**: [../README.md](../README.md)
2. **Try basic commands**: `switch-ai models`, `switch-ai status`
3. **Review configuration**: `switch-ai config list`
4. **Check CLI reference**: [CLI-REFERENCE.md](CLI-REFERENCE.md)
5. **Learn about decision making**: [DECISION-ENGINE.md](DECISION-ENGINE.md)

---

## Getting Help

- **Command help**: `switch-ai help [command]`
- **Documentation**: `switch-ai docs`
- **Issues**: [GitHub Issues](https://github.com/yourusername/switch-ai/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/switch-ai/discussions)
