# Technical Design Decisions

## Architecture Decision Records

### ADR-001: HTTP Proxy vs SDK Wrapper

**Decision:** Implement as HTTP proxy (localhost:4000) rather than SDK wrapper

**Rationale:**
- **Compatibility**: Works with ANY language/SDK that supports ANTHROPIC API v1
- **Transparency**: Requests/responses flow through unchanged
- **Upgradability**: Can upgrade Switch AI without code changes
- **Central Control**: Single point for logging, validation, learning

**Alternatives Rejected:**
- SDK wrapper: Limited to JavaScript/TypeScript only
- API gateway: Requires deployment, adds complexity

**Impact:**
- Users just change `ANTHROPIC_BASE_URL` environment variable
- No code changes needed
- Enables VSCode integration with existing Claude Code extension

---

### ADR-002: SQLite for Learning Database

**Decision:** Use SQLite for memory system instead of external database

**Rationale:**
- **Zero Dependencies**: No external services to manage
- **Local First**: All learning data stays on user's machine (privacy)
- **Sufficient Capacity**: Can store 10,000+ request records
- **Simple Queries**: 6 tables with straightforward access patterns
- **Offline Support**: Works without internet connection

**Alternatives Rejected:**
- PostgreSQL: Adds deployment complexity, overkill for v0.1
- Redis: Volatile, requires separate service
- File-based (JSON): Poor query performance

**Impact:**
- Store at `~/.switch-ai/memory.db`
- Auto-create on first run
- Automatic cleanup (90-day retention by default)

---

### ADR-003: Complexity Analysis Approach

**Decision:** Use heuristic keyword analysis + optional meta-AI, not ML model

**Rationale:**
- **Fast**: Heuristic analysis <100ms, no API calls needed
- **Deterministic**: Same input always gives same score (debuggable)
- **Optional Enhancement**: Can use meta-AI (Haiku) for unclear cases
- **Works Offline**: No external API dependency

**Heuristic Algorithm:**
1. Extract keywords from prompt
2. Assign base score per category (1-10)
3. Apply modifiers (time constraint, language, project context)
4. Clamp to 1-10 range

**Alternatives Rejected:**
- Pure ML model: Requires training data, slower, black-box
- Simple word count: Too naive, misses context
- Always use meta-AI: Adds latency and cost for every request

**Impact:**
- Complexity analysis latency <100ms
- No cost for analysis
- Accurate for 90%+ of cases
- Can enhance with meta-AI when confidence < 50%

---

### ADR-004: Tier-Based Model Selection

**Decision:** Organize models into 4 tiers (Free, Cheap, Balanced, Premium)

**Rationale:**
- **Clear Mapping**: Task complexity directly maps to tier
- **Understandable**: Users can reason about decisions
- **Flexible**: Can customize tier definitions per user
- **Scalable**: Easy to add new models to existing tiers

**Tier Definitions:**
- **Free** ($0): Claude Code, Gemini Free, Ollama local
- **Cheap** ($0.001-0.003): Haiku, Deepseek, Gemini Flash
- **Balanced** ($0.01-0.03): Sonnet, GPT-4 Turbo
- **Premium** ($0.05-0.30): Opus, Claude 4.6, GPT-4o

**Alternatives Rejected:**
- Flat list: Hard to reason about selection
- Cost-only: Ignores capability differences
- Capability-only: Doesn't account for cost

**Impact:**
- Clear tier hierarchy
- Easy to configure user preferences
- Simple fallback chain per tier

---

### ADR-005: Node.js + TypeScript

**Decision:** Implement in Node.js with TypeScript

**Rationale:**
- **Cross-Platform**: macOS, Linux, Windows (WSL2)
- **Async I/O**: Perfect for proxy/HTTP work
- **Type Safety**: Prevents bugs, great IDE support
- **Easy Distribution**: `npm install -g` / `npx`
- **Ecosystem**: Excellent CLI tools, testing frameworks

**Alternatives Rejected:**
- Python: Slower startup, harder to distribute
- Rust: Overkill for v0.1, steeper learning curve
- Go: Less mature CLI ecosystem

**Impact:**
- Use Node 18+ (ES modules)
- TypeScript strict mode enforced
- Target: npm registry for distribution

---

### ADR-006: Learning System Design

**Decision:** Synchronous SQLite with periodic aggregation

**Rationale:**
- **Simple**: No async complexity, no race conditions
- **Reliable**: Transactions built-in, no data loss
- **Fast**: In-process database
- **Maintainable**: Clear data model, easy queries

**Learning Loop:**
1. Request made → logged to `requests` table
2. Response validated → status recorded
3. Model performance updated → `model_performance` table
4. Failure patterns tracked → `failure_patterns` table
5. Auto-blacklist checked → `failure_patterns.blacklist_until`

**Alternatives Rejected:**
- Async queue + async database: Adds complexity
- Event streaming: Overkill for learning system
- REST API: External service overhead

**Impact:**
- Request logging adds <5ms overhead
- Memory updates <10ms
- Full history queryable in real-time

---

### ADR-007: CLI Framework

**Decision:** Use Commander.js for CLI

**Rationale:**
- **Standard**: Most popular CLI library in Node.js
- **Mature**: Stable API, good documentation
- **Flexible**: Supports subcommands, options, help
- **DX**: Auto-generates help, argument parsing

**Alternatives Rejected:**
- Yargs: More complex than needed
- Clap (Rust-style): Doesn't fit Node ecosystem
- Manual parsing: Error-prone

**Impact:**
- Clear command structure
- Auto-generated help (`switch-ai --help`)
- Easy to add new commands

---

### ADR-008: Configuration Hierarchy

**Decision:** Three-level config with clear precedence

**Precedence (highest to lowest):**
1. Command-line flags (`--port 5000`)
2. Environment variables (`SWITCH_AI_PORT=5000`)
3. Config file (`~/.switch-ai/config.json`)
4. Built-in defaults

**Rationale:**
- **Flexible**: Different deployment contexts
- **Clear**: Precedence is unambiguous
- **Familiar**: Matches industry standard patterns

**Alternatives Rejected:**
- Single source: Less flexible
- Config file only: Hard to override in CI/CD
- Env vars only: Hard to persist defaults

**Impact:**
- Users can configure for their use case
- CI/CD can override with env vars
- Defaults work out of box

---

## Implementation Strategy

### Phase-Based Delivery
1. **Infrastructure** (12h): Server, config, database
2. **Decision** (20h): Analysis, registry, selection
3. **Routing** (12h): LiteLLM, Claude Code, orchestration
4. **Quality** (13h): Validation, learning
5. **CLI** (14h): Commands, integration
6. **Testing** (14h): Unit, integration, E2E
7. **Docs** (6h): JSDoc, comments
8. **Release** (2h): Publish, GitHub release

### Code Organization
```
src/
├── server/          # HTTP proxy
├── core/            # Decision engine
├── registry/        # Model registry
├── backends/        # Provider integrations
├── memory/          # SQLite learning system
├── cli/             # CLI commands
└── config/          # Configuration system
```

### Testing Strategy
- **Unit tests**: Core logic (complexity, selection, validator)
- **Integration tests**: Full request flow with mock backends
- **E2E tests**: Real OpenRouter API (with OPENROUTER_KEY from .env)
- **Coverage target**: >80% for core modules

### Quality Gates
- TypeScript strict mode (no `any`, no implicit types)
- ESLint with no warnings
- Prettier auto-format
- All tests passing
- Coverage >80%
- No console.log in production code (use logging module)

### Documentation Strategy
- JSDoc for all exports
- Inline comments for complex logic
- Type definitions clear and understandable
- README.md in src/ with module descriptions
