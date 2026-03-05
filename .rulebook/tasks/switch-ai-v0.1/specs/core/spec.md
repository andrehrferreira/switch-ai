# Core Module Specifications

## ADDED Requirements

### Requirement: HTTP Proxy Server
The system SHALL accept ANTHROPIC API v1 compatible requests on localhost:4000 and route them through the decision engine.

#### Scenario: Handle Valid Request
Given a valid ANTHROPIC API request
When sent to localhost:4000/v1/messages
Then the proxy MUST forward to decision engine and return response unchanged

#### Scenario: Invalid Request
Given an invalid request (missing fields)
When sent to proxy
Then the system MUST return HTTP 400 with validation error

### Requirement: Complexity Analysis
The system SHALL analyze request complexity and assign score (1-10) and category.

#### Scenario: Documentation Task
Given a prompt containing "write README"
When analyzed by complexity analyzer
Then complexity_score MUST be 1-3 and category MUST be "documentation"

#### Scenario: Architecture Task
Given a prompt containing "design microservices"
When analyzed by complexity analyzer
Then complexity_score MUST be 8-10 and category MUST be "architecture"

### Requirement: Model Selection
The system SHALL select best-fit model using 7-step algorithm.

#### Scenario: Simple Task Selection
Given complexity_score = 2 (simple)
When selection algorithm runs
Then selected model tier MUST be free or cheap

#### Scenario: Complex Task Selection
Given complexity_score = 9 (complex)
When selection algorithm runs
Then selected model tier MUST be balanced or premium

### Requirement: Configuration Management
The system SHALL load configuration from file and environment variables with validation.

#### Scenario: Load Config File
Given ~/.switch-ai/config.json exists with valid JSON
When system starts
Then config MUST be loaded and validated against schema

#### Scenario: Env Override
Given env var SWITCH_AI_PORT=5000 is set
And config.json has port: 4000
When system loads config
Then resulting port MUST be 5000

### Requirement: SQLite Database
The system SHALL initialize database with required tables and indexes.

#### Scenario: First Run
Given no database exists
When system starts
Then database file MUST be created at ~/.switch-ai/memory.db
And all 6 tables MUST be created
And all indexes MUST be present

## MODIFIED Requirements

None (new system)

## REMOVED Requirements

None (new system)
