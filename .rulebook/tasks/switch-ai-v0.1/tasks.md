# Phase 1: Infrastructure

- [x] 1.1 Project setup and dependencies
- [x] 1.2 HTTP proxy server (ANTHROPIC API v1)
- [x] 1.3 Configuration system (config.json + env vars)
- [x] 1.4 SQLite database initialization

# Phase 2: Decision Engine

- [x] 2.1 Complexity analyzer (prompt + context)
- [x] 2.2 Model registry and capability scanner
- [x] 2.3 Selection algorithm (7-step decision tree)
- [x] 2.4 Confidence scoring and fallback chain

# Phase 3: Routing

- [x] 3.1 OpenRouter backend integration (via /v1/chat/completions)
- [x] 3.2 Claude Code CLI backend (detects + spawns `claude --print`)
- [x] 3.3 Gemini CLI support (detects + spawns `gemini`)
- [x] 3.4 Router orchestration with fallbacks (tryModel + fallback chain)

# Phase 4: Quality

- [x] 4.1 Response quality validator (validator.ts — heuristic scoring)
- [x] 4.2 SQLite schema usage — recorder.ts (requests + model_performance)
- [x] 4.3 Learning system and blacklisting (learning.ts — failure patterns + 30min blacklist)
- [x] 4.4 Cost aggregation and analytics (analytics.ts — performance stats + cost summary)

# Phase 5: CLI

- [x] 5.1 Core commands (start, stop, status — with PID file for out-of-process stop)
- [x] 5.2 Model management (models list/show/sync — tier+category filters, --json)
- [x] 5.3 Key management (keys set/list/export/validate — ~/.switch-ai/keys.env)
- [x] 5.4 Claude integration (switch-ai claude [args...] — auto-starts proxy, sets ANTHROPIC_BASE_URL)
- [x] 5.5 History and analysis (history --limit N, stats — per-model/category breakdown)

# Phase 6: Testing

- [x] 6.1 Unit tests (100% coverage — 315 tests, 29 files)
- [ ] 6.2 Integration tests (full flow)
- [ ] 6.3 E2E tests (real OpenRouter API)

# Phase 7: Documentation

- [ ] 7.1 JSDoc comments for all exports
- [ ] 7.2 Type definitions and inline docs
- [ ] 7.3 Architecture documentation

# Phase 8: Release

- [ ] 8.1 Version bump to 0.1.0
- [ ] 8.2 CHANGELOG update
- [ ] 8.3 npm publish
- [ ] 8.4 GitHub release created
