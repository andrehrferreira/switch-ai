# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
