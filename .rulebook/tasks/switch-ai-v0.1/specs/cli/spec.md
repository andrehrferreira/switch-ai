# CLI Module Specifications

## ADDED Requirements

### Requirement: Start Command
The system SHALL provide `switch-ai start` command that starts proxy server.

#### Scenario: Start on Default Port
Given user runs: switch-ai start
When command executes
Then server MUST listen on localhost:4000
And command MUST output "✓ Switch AI proxy started"

#### Scenario: Start on Custom Port
Given user runs: switch-ai start --port 5000
When command executes
Then server MUST listen on localhost:5000

#### Scenario: Daemon Mode
Given user runs: switch-ai start --daemon
When command executes
Then server MUST start in background
And command MUST output PID

### Requirement: Stop Command
The system SHALL provide `switch-ai stop` command that stops proxy server.

#### Scenario: Stop Running Server
Given server is running (PID: 12345)
When user runs: switch-ai stop
Then server MUST shut down gracefully
And command MUST output "✓ Switch AI proxy stopped"

### Requirement: Status Command
The system SHALL provide `switch-ai status` command that shows server status.

#### Scenario: Server Running
Given server is running
When user runs: switch-ai status
Then output MUST show "✓ Switch AI is running"
And output MUST include PID, port, uptime

#### Scenario: Server Not Running
Given server is not running
When user runs: switch-ai status
Then output MUST show "✗ Switch AI is not running"

### Requirement: Claude Integration Command
The system SHALL provide `switch-ai claude` command that starts proxy + launches Claude Code.

#### Scenario: Quick Start
Given user runs: switch-ai claude
When command executes
Then proxy MUST start on localhost:4000
And ANTHROPIC_BASE_URL MUST be exported to current shell
And claude command MUST launch

#### Scenario: With Key Setup
Given user runs: switch-ai claude --with-keys
When command executes
Then system MUST prompt for OpenRouter key first
Then proceed with normal startup

### Requirement: Key Management Commands
The system SHALL provide `switch-ai keys` command to manage API keys securely.

#### Scenario: Set Key Interactively
Given user runs: switch-ai keys set openrouter
When prompted for key
Then input MUST be masked (not visible in terminal)
And key MUST be stored encrypted in ~/.switch-ai/keys.enc

#### Scenario: List Keys
Given user runs: switch-ai keys list
When command executes
Then output MUST show all keys masked (sk-or-***..)
And output MUST NOT show full keys

#### Scenario: Export Keys
Given user runs: switch-ai keys export > .env
When command executes
Then .env file MUST contain all keys in VAR=value format

### Requirement: Model Commands
The system SHALL provide `switch-ai models` command to list models.

#### Scenario: List All Models
Given user runs: switch-ai models
When command executes
Then output MUST show 20+ models
And models MUST be grouped by tier (free, cheap, balanced, premium)

#### Scenario: Show Model Stats
Given user runs: switch-ai models --with-stats
When command executes
Then output MUST include success rate for each model
And output MUST include average latency

### Requirement: History Commands
The system SHALL provide `switch-ai history` command to query request history.

#### Scenario: Show Recent Requests
Given user runs: switch-ai history --limit 50
When command executes
Then output MUST show last 50 requests
And each row MUST include: timestamp, category, model, status, cost

#### Scenario: Filter by Model
Given user runs: switch-ai history --model haiku
When command executes
Then output MUST only show requests that used haiku model

## MODIFIED Requirements

None (new system)

## REMOVED Requirements

None (new system)
