# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-03-12

### Changed

- **Replaced `better-sqlite3` with `sql.js`**: Eliminated native binary dependency (no more `node-gyp` or C++ compilation required). The database layer now uses a pure WebAssembly SQLite implementation, making installation seamless across all platforms.
- **Database `connect()` is now async**: All callers updated to `await` the connection (required by sql.js async WASM initialization).
- **Updated all dependencies** to latest compatible versions:
  - `axios` ^1.6.8 → ^1.13.6
  - `chalk` ^5.3.0 → ^5.6.2
  - `dotenv` ^16.3.1 → ^16.5.0
  - `fastify` ^5.7.4 → ^5.8.2
  - `openai` ^6.25.0 → ^6.27.0
  - `zod` ^3.22.4 → ^3.24.0
  - `typescript` ^5.3.3 → ^5.8.0
  - `vitest` ^1.1.0 → ^3.2.0
  - `@vitest/coverage-v8` ^1.1.0 → ^3.2.0
  - `@types/node` ^20.10.6 → ^22.15.0
  - `@typescript-eslint/*` ^6.17.0 → ^8.57.0
  - `prettier` ^3.1.1 → ^3.8.1
  - `tsx` ^4.7.0 → ^4.21.0

### Removed

- `better-sqlite3` and `@types/better-sqlite3` dependencies.

### Added

- `sql.js` and `@types/sql.js` dependencies.
- `main`, `types`, and `files` fields in `package.json` for proper npm publishing.

## [0.1.0] - 2026-03-05

### Added

- **HTTP Proxy Server**: Anthropic API v1-compatible proxy that intercepts requests and routes them intelligently.
- **Configuration System**: `config.json` + environment variable support via `zod` schema validation.
- **SQLite Database**: Persistent storage for request history, model performance, and learning data.
- **Complexity Analyzer**: Prompt + context analysis to determine task complexity (simple, moderate, complex, expert).
- **Model Registry**: Capability scanner with tier/category classification and OpenRouter model sync.
- **Selection Algorithm**: 7-step decision tree for optimal model selection with confidence scoring.
- **Fallback Chain**: Automatic fallback to alternative models on failure.
- **OpenRouter Backend**: Integration via `/v1/chat/completions` with cost tracking.
- **Claude Code CLI Backend**: Detects and spawns `claude --print` for local Claude usage.
- **Gemini CLI Backend**: Detects and spawns `gemini` CLI for local Gemini usage.
- **Cursor Agent Backend**: Support for cursor-agent CLI backend.
- **Gemini API Backend**: Direct Gemini API integration.
- **Router Orchestration**: Unified router with backend preference and fallback chain support.
- **Response Validator**: Heuristic quality scoring for model responses.
- **Learning System**: Failure pattern detection with 30-minute model blacklisting.
- **Cost Aggregation**: Analytics with per-model/category performance stats and cost summaries.
- **CLI Commands**:
  - `start` / `stop` / `status` with PID file management.
  - `models list/show/sync` with tier and category filters, `--json` output.
  - `keys set/list/export/validate` for API key management (`~/.switch-ai/keys.env`).
  - `claude [args...]` auto-starts proxy and sets `ANTHROPIC_BASE_URL`.
  - `history --limit N` and `stats` for request history and per-model breakdowns.
  - `dashboard` command to open the web dashboard.
- **Dashboard (Web UI)**:
  - Dark-themed dashboard with sidebar navigation (Dashboard, Requests, Models, Blacklist, Backends views).
  - Stats grid: total requests, success rate, avg latency, total cost.
  - Activity chart: hourly bar chart of requests (last 24h).
  - Backends panel with online/offline status.
  - Recent requests list with status, model, latency, and timestamp.
  - Model performance table with success rate bars and latency.
  - Blacklist panel with expiry times.
  - Categories panel with distribution bars.
  - Debug toggle and backend selector controls.
  - Dedicated Requests view with filters (model, status, date range), search, and pagination.
  - CSV/JSON export for request data.
  - Responsive design for smaller screens.
  - Auto-refresh every 5 seconds.
- **Dashboard API**:
  - `GET /api/stats`, `/api/requests`, `/api/models`, `/api/blacklist`, `/api/categories`, `/api/activity`, `/api/backends`.
  - `GET/POST /api/debug` and `/api/backend` control endpoints.
  - Pagination (`offset` param) and filtering (`model`, `status`, `from`, `to`) on `/api/requests`.
  - `GET /api/requests/export?format=csv|json` for data export.
- **Unit Tests**: Comprehensive test coverage for core, config, memory, server, CLI, and backend modules.
- **Documentation**: PRD, Architecture, Decision Engine, Model Tiers, Memory System, Installation, Configuration, CLI Reference, and VS Code Integration docs.
