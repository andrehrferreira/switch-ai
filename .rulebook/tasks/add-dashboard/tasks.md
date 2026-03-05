## 1. Backend Implementation (Fastify)

- [ ] 1.1 `Setup Fastify Server`: Initialize a Fastify server in `src/cli/server/dashboard-server.ts`.
- [ ] 1.2 `Create API Endpoints`:
    - [ ] `GET /api/calls`: comprehensive, paginated, and filterable endpoint for all requests.
    - [ ] `GET /api/stats`: endpoint for aggregated data (total cost, etc.).
    - [ ] `GET /api/chart-data`: endpoints to provide data formatted for charts.
- [ ] 1.3 `Database Integration`: Connect endpoints to `databaseManager` to query SQLite with filters.

## 2. Frontend Implementation (Vue.js)

- [ ] 2.1 `Setup Vue.js Project`: Create a new Vue.js project inside a `dashboard-ui` directory.
- [ ] 2.2 `Create UI Components`:
    - [ ] `CallsTable.vue`: A component for the filterable and searchable table.
    - [ ] `Filters.vue`: A component with controls for date range, model, and status.
    - [ ] `Charts.vue`: Components for displaying trend charts.
- [ ] 2.3 `API Integration`: Connect frontend components to the backend APIs with 3-second polling.
- [ ] 2.4 `Build Process`: Configure the build process to output static assets that the Fastify server can serve.

## 3. CLI and Final Integration

- [ ] 3.1 `Update CLI Command`: Modify `src/cli/commands/dashboard.ts` to serve the built Vue.js app.
- [ ] 3.2 `Data Export`: Implement CSV/JSON export functionality.

## 4. Testing

- [ ] 4.1 `Backend Tests`: Unit tests for all Fastify endpoints, including filter and pagination logic.
- [ ] 4.2 `Frontend Tests`: Component tests for the Vue.js UI.
- [ ] 4.3 `E2E Tests`: End-to-end tests to simulate user interaction.
- [ ] 4.4 `Coverage`: Ensure test coverage remains ≥ 95%.

## 5. Documentation

- [ ] 5.1 `Update Spec`: Revise `specs/cli/spec.md` with the updated requirements.
