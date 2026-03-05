# Routing Module Specifications

## ADDED Requirements

### Requirement: LiteLLM Backend
The system SHALL route OpenRouter model requests through LiteLLM.

#### Scenario: Route Haiku Request
Given decision engine selects haiku model
And request is for OpenRouter
When router executes
Then request MUST be forwarded to LiteLLM on localhost:8000
And LiteLLM MUST call OpenRouter API
And response MUST be returned unchanged to client

#### Scenario: LiteLLM Timeout
Given LiteLLM takes >30 seconds to respond
When router waits
Then router MUST timeout
And escalate to next model in fallback chain

### Requirement: Claude Code CLI Backend
The system SHALL route requests to Claude Code CLI when selected.

#### Scenario: Route to Claude Code
Given decision engine selects claude-code model
When router executes
Then router MUST invoke: claude --model <tier> --input <file>
And parse response from stdout
And return to client

#### Scenario: Insufficient Credits
Given Claude Code has 0 credits remaining
When router attempts to execute
Then router MUST skip this model
And try next in fallback chain

### Requirement: Gemini and Ollama Support
The system SHALL support Gemini CLI and Ollama local models.

#### Scenario: Route to Gemini
Given decision engine selects gemini model
When router executes
Then router MUST invoke gemini CLI
And forward response to client

#### Scenario: Route to Ollama
Given decision engine selects ollama model
And Ollama is running on localhost:11434
When router executes
Then router MUST send request to Ollama endpoint
And forward response to client

### Requirement: Fallback Chain
The system SHALL implement fallback chain (3+ alternatives per selection).

#### Scenario: Primary Model Fails
Given primary model is haiku
And haiku returns error
When router gets error response
Then router MUST try fallback[0] (e.g., deepseek)
And if deepseek also fails, try fallback[1] (e.g., sonnet)

#### Scenario: All Models Fail
Given all models in fallback chain fail
When router exhausts retries
Then router MUST return error to client
And log all attempts to memory

### Requirement: Response Validation
The system SHALL validate response quality before returning.

#### Scenario: Validate Completeness
Given response received from model
When validator runs
Then validator MUST check:
  - Response is not empty
  - Response is not truncated
  - Response has reasonable length for task

#### Scenario: Code Validation
Given response contains code
When validator runs
Then validator MUST attempt to parse/compile code
And flag if syntax is invalid

### Requirement: Cost Calculation
The system SHALL calculate cost for each request.

#### Scenario: Calculate Haiku Cost
Given request uses haiku model
And input: 100 tokens, output: 200 tokens
When cost calculated
Then cost MUST be: (100 * $0/1k) + (200 * $0.0004/1k) = $0.00008

#### Scenario: Calculate Opus Cost
Given request uses claude-opus model
And input: 1000 tokens, output: 1000 tokens
When cost calculated
Then cost MUST be: (1000 * $0.015/1k) + (1000 * $0.075/1k) = $0.09

### Requirement: Escalation Logic
The system SHALL escalate to better model if validation fails.

#### Scenario: Escalate on Truncation
Given haiku response is truncated
When validator detects truncation
Then router MUST escalate to next tier (sonnet)
And re-send request to sonnet
And return sonnet response to client

#### Scenario: Track Escalations
Given escalation occurs
When router completes request
Then escalation MUST be logged to memory with:
  - from_model, to_model
  - reason (truncation, timeout, etc)
  - success/failure

## MODIFIED Requirements

None (new system)

## REMOVED Requirements

None (new system)
