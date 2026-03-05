## ADDED Requirements

### Requirement: Dashboard Command
The CLI MUST provide a `dashboard` command that starts a local HTTP server serving a real-time web UI for monitoring model routing decisions.

#### Scenario: Start dashboard with default port
Given the user runs `switch-ai dashboard`
When the command executes
Then a local HTTP server SHALL start on port 4000 and open the browser at `http://localhost:4000`

#### Scenario: Start dashboard with custom port
Given the user runs `switch-ai dashboard --port 8080`
When the command executes
Then the server SHALL start on port 8080 and open the browser at `http://localhost:8080`

#### Scenario: Start dashboard without opening browser
Given the user runs `switch-ai dashboard --no-open`
When the command executes
Then the server SHALL start and print the URL without opening the browser

#### Scenario: Database not available
Given the switch-ai database has not been initialized
When the user runs `switch-ai dashboard`
Then the command SHALL print an error message and exit with a non-zero code

### Requirement: Dashboard Overview Endpoint
The dashboard server MUST expose `GET /api/overview` returning aggregated statistics as JSON.

#### Scenario: Overview with recorded requests
Given at least one request has been recorded in the database
When a client calls `GET /api/overview`
Then the response SHALL contain `totalRequests`, `totalCost`, `successRate`, and `uniqueModels` fields

#### Scenario: Overview with empty database
Given no requests have been recorded
When a client calls `GET /api/overview`
Then the response SHALL return zeroed values for all numeric fields

### Requirement: Dashboard Requests Endpoint
The dashboard server MUST expose `GET /api/requests` returning the most recent routing decisions as a JSON array.

#### Scenario: Requests list
Given requests exist in the database
When a client calls `GET /api/requests`
Then the response SHALL be a JSON array where each item contains `timestamp`, `initialModel`, `finalModel`, `category`, `complexityScore`, `latencyMs`, `cost`, and `status`

### Requirement: Dashboard Models Endpoint
The dashboard server MUST expose `GET /api/models` returning model performance data grouped by category.

#### Scenario: Model performance list
Given model performance records exist
When a client calls `GET /api/models`
Then the response SHALL be a JSON array where each item contains `model`, `category`, `successRate`, `avgLatencyMs`, `avgCost`, and `attempts`

### Requirement: Dashboard Escalations Endpoint
The dashboard server MUST expose `GET /api/escalations` returning recent model escalation events as a JSON array.

#### Scenario: Escalations list
Given escalation records exist in the database
When a client calls `GET /api/escalations`
Then the response SHALL be a JSON array where each item contains `fromModel`, `toModel`, `category`, and `reason`

### Requirement: Dashboard UI Auto-Refresh
The dashboard web UI MUST automatically refresh its data without requiring a page reload.

#### Scenario: Polling interval
Given the dashboard page is open in a browser
When 3 seconds have elapsed since the last data fetch
Then the UI SHALL fetch all API endpoints again and update the displayed data

### Requirement: Dashboard Zero Dependencies
The dashboard server MUST be implemented using only Node.js built-in modules and packages already listed in `package.json`.

#### Scenario: No new runtime dependencies
Given the dashboard feature is implemented
When `package.json` dependencies are inspected
Then no new entries SHALL have been added to the `dependencies` field
