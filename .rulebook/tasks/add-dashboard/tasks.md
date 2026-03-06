## 1. Backend API (HTTP Server - `src/server/`)

- [x] 1.1 `Server setup`: HTTP server in `src/server/index.ts` serves dashboard at `/` and `/dashboard`.
- [x] 1.2 `Core API endpoints`:
    - [x] `GET /api/stats`: Aggregated stats (total requests, success rate, avg latency, cost).
    - [x] `GET /api/requests?limit=N`: Recent requests list.
    - [x] `GET /api/models`: Model performance data.
    - [x] `GET /api/blacklist`: Active model blacklist.
    - [x] `GET /api/categories`: Request categories with success rates.
    - [x] `GET /api/activity`: Hourly activity chart data (last 24h).
    - [x] `GET /api/backends`: Backend availability (claude-cli, gemini-cli, cursor-agent, gemini-api, openrouter).
- [x] 1.3 `Control API endpoints`:
    - [x] `GET/POST /api/debug`: Toggle log level (debug/info).
    - [x] `GET/POST /api/backend`: Force specific backend or auto mode.
- [x] 1.4 `Database integration`: All endpoints query SQLite via `databaseManager`.
- [x] 1.5 `Pagination on requests`: Add `offset` parameter to `/api/requests` for proper pagination.
- [x] 1.6 `Filtering on requests`: Add query params `?model=X&status=success&from=DATE&to=DATE` to `/api/requests`.
- [x] 1.7 `CSV/JSON export`: `GET /api/requests/export?format=csv` and `format=json` for data export.

## 2. Frontend (Inline HTML/CSS/JS - `src/server/dashboard-html.ts`)

- [x] 2.1 `Dashboard layout`: Header, sidebar, main content area with dark theme.
- [x] 2.2 `Stats grid`: Total requests, success rate, avg latency, total cost cards.
- [x] 2.3 `Activity chart`: Bar chart of hourly requests (last 24h).
- [x] 2.4 `Backends panel`: Shows all backends with online/offline status.
- [x] 2.5 `Recent requests list`: Shows last 20 requests with status, model, latency, time.
- [x] 2.6 `Model performance table`: Top models with success rate bars and latency.
- [x] 2.7 `Blacklist panel`: Active model blocks with expiry time.
- [x] 2.8 `Categories panel`: Request categories with distribution bars.
- [x] 2.9 `Debug toggle button`: Toggle debug/info log level from the dashboard.
- [x] 2.10 `Backend selector`: Force specific backend (auto, claude-cli, gemini-cli, cursor-agent, gemini-api, openrouter).
- [x] 2.11 `Auto-refresh`: All panels refresh every 5 seconds.
- [x] 2.12 `Sidebar navigation`: Make sidebar links switch between views (Dashboard, Requests, Models, Blacklist, Backends).
- [x] 2.13 `Requests view`: Dedicated full-page view with filters (model, status, date range), search, and pagination.
- [x] 2.14 `Export button`: Button to download requests as CSV/JSON.
- [x] 2.15 `Responsive design`: Ensure dashboard works on smaller screens.

## 3. Testing

- [x] 3.1 `Dashboard API tests`: Unit tests for all endpoints in `src/server/dashboard-api.ts` (stats, requests, models, blacklist, categories, activity, backends).
- [x] 3.2 `Control API tests`: Tests for `/api/debug` and `/api/backend` toggle endpoints.
- [x] 3.3 `Server handler tests`: Tests for SSE streaming, non-streaming responses, and error handling in `src/server/index.ts`.
- [x] 3.4 `Coverage`: Ensure test coverage remains >= 95%.
