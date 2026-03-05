# Proposal: add-dashboard

## Why

switch-ai already collects rich data for every request (selected model, category, complexity score, latency, cost, escalations, success status) in SQLite, but the only way to inspect it is via `switch-ai history` and `switch-ai stats` — plain terminal text with no temporal or comparative context. A real-time web dashboard lets users watch model routing decisions as they happen, spot escalation patterns, compare per-model and per-category performance, and track cumulative cost — without repeatedly running CLI commands.

## What Changes

### New CLI command: `switch-ai dashboard`

Starts a local HTTP server (configurable port, default 4000) that serves a single-page web dashboard. The dashboard reads from the same SQLite database the proxy writes to and auto-refreshes via polling every 3 seconds.

### Dashboard Features

1.  **Overview**: Real-time summary cards with metrics like total requests, total cost, and success rate.
2.  **Calls Table**: A comprehensive, filterable, and searchable table of all requests, with pagination.
    *   **Columns**: Timestamp, Initial Model, Final Model, Category, Complexity, Latency, Cost, and Status.
    *   **Filtering**: By date range, model, category, and status.
    *   **Search**: Full-text search on models and categories.
3.  **Performance Analytics**:
    *   **Charts**: Trend charts for cost and latency over time.
    *   **Model Leaderboard**: Per-category ranking of models by success rate, latency, and cost.
4.  **Data Export**: Ability to export the filtered call data as a CSV or JSON file.

### Implementation Approach

-   **Backend**: A Node.js HTTP server built with a lightweight framework like **Fastify** or **Express** for robust routing and performance. Endpoints will support filtering, sorting, and pagination.
-   **Frontend**: A responsive single-page application built with **Vue.js** or **React**, providing an interactive user experience.
    *   **UI Components**: Reusable components for the table, filters, and charts.
    *   **Charting**: A library like **Chart.js** or **D3.js** for data visualization.
- Reads directly from SQLite via the existing `databaseManager`

## Impact

- Affected specs: `specs/cli/spec.md` (new `dashboard` command)
- Affected code: `src/cli/commands/dashboard.ts` (new), `src/cli/server/dashboard-server.ts` (new), `src/cli/index.ts` (modified)
- Breaking change: NO
- User benefit: Real-time visibility into automatic model routing decisions with no new runtime dependencies
