/**
 * Agent Types
 */

import type { ChatCompletionMessageParam, ProviderConfig, ProviderInstance } from '@ai-stack/provider';
import type { MCPToolBridgeOptions } from '@ai-stack/mcp';
import type { SkillToolBridgeOptions, SkillEntry } from '@ai-stack/skill';
import type { MemoryConfig, TokenBudget, WritePolicyConfig, RetrievalConfig } from '@ai-stack/memory';
import type { CodeIndexerConfig, DocIndexerConfig, DocSourceInput } from '@ai-stack/knowledge';
import type {
  PermissionLevel,
  ToolCategory,
  PermissionRule,
  PermissionPolicyConfig,
  ConfirmationRequest,
  ConfirmationResponse,
} from './permission/types.js';

/**
 * MCP configuration for Agent
 */
export interface AgentMCPConfig {
  /** Path to MCP configuration file (e.g., '.mcp.json') */
  configPath?: string;
  /** Inline MCP server configurations */
  servers?: Record<string, {
    type?: 'stdio' | 'http';
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    timeout?: number;
  }>;
  /** Tool bridge options for naming and filtering */
  toolOptions?: MCPToolBridgeOptions;
  /** Whether to auto-connect on agent initialization */
  autoConnect?: boolean;
}

/**
 * Skill configuration for Agent
 */
export interface AgentSkillConfig {
  /** Path to skill configuration file (e.g., 'skills.json') */
  configPath?: string;
  /** Directories to auto-discover skills from */
  directories?: string[];
  /** Inline skill configurations */
  skills?: Record<string, SkillEntry>;
  /** Tool bridge options for naming and filtering */
  toolOptions?: SkillToolBridgeOptions;
  /** Whether to auto-load all skills on agent initialization */
  autoLoad?: boolean;
}

/**
 * Memory configuration for Agent
 */
export interface AgentMemoryConfig {
  /** Whether to enable memory (default: true if config provided) */
  enabled?: boolean;
  /** Database file path (default: 'memory/sqlite.db') */
  dbPath?: string;
  /** Token budget configuration */
  tokenBudget?: Partial<TokenBudget>;
  /** Write policy configuration */
  writePolicy?: Partial<WritePolicyConfig>;
  /** Retrieval configuration */
  retrieval?: Partial<RetrievalConfig>;
  /** Whether to auto-initialize on first chat (default: true) */
  autoInitialize?: boolean;
  /** Whether to auto-inject memory context into prompts (default: true) */
  autoInject?: boolean;
  /** Whether to enable semantic search with embeddings (default: false, requires embedding generation) */
  enableSemanticSearch?: boolean;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Knowledge configuration for Agent
 */
export interface AgentKnowledgeConfig {
  /** Whether to enable knowledge (default: true if config provided) */
  enabled?: boolean;

  /** Database path for knowledge persistence (default: 'knowledge/sqlite.db') */
  dbPath?: string;

  /** Code indexing configuration */
  code?: Partial<CodeIndexerConfig> & {
    /** Enable code indexing (default: true) */
    enabled?: boolean;
  };

  /** Document indexing configuration */
  doc?: Partial<DocIndexerConfig> & {
    /** Enable document indexing (default: true) */
    enabled?: boolean;
    /** Pre-configured document sources */
    sources?: DocSourceInput[];
  };

  /** Search configuration */
  search?: {
    /** Whether to auto-search knowledge on each chat (default: true) */
    autoSearch?: boolean;
    /** Whether to auto-inject knowledge context into prompts (default: true) */
    autoInject?: boolean;
    /** Minimum relevance score for results (default: 0.3) */
    minScore?: number;
    /** Maximum results to include in context (default: 5) */
    maxResults?: number;
    /** Default search weights */
    weights?: { fts: number; vector: number };
  };

  /** Whether to auto-initialize on first chat (default: true) */
  autoInitialize?: boolean;

  /** Enable debug logging */
  debug?: boolean;
}

export interface AgentConfig {
  /** Agent name for identification */
  name?: string;
  /** System prompt that defines the agent's behavior */
  systemPrompt?: string;
  /** Model to use (defaults to gpt-4o for OpenAI) */
  model?: string;
  /** Temperature for response generation (0-2) */
  temperature?: number;
  /** Maximum tokens in response */
  maxTokens?: number;
  /** API key (defaults to OPENAI_API_KEY env var) */
  apiKey?: string;
  /** Base URL for API (for custom endpoints) */
  baseURL?: string;
  /** MCP configuration for connecting to MCP servers */
  mcp?: AgentMCPConfig;
  /** Skill configuration for loading and managing skills */
  skill?: AgentSkillConfig;
  /** Memory configuration for persistent memory */
  memory?: AgentMemoryConfig | boolean;
  /** Knowledge configuration for code and document indexing */
  knowledge?: AgentKnowledgeConfig | boolean;
  /** Permission configuration for tool execution control */
  permission?: AgentPermissionConfig | boolean;
  /** Tool execution configuration for parallel execution */
  toolExecution?: ToolExecutionConfig;
  /** Telemetry configuration for observability */
  telemetry?: TelemetryConfig;
  /** Stop conditions for execution control */
  stopConditions?: StopConditions;
  /** Planning configuration for transparency */
  planning?: PlanningConfig;

  /**
   * Callback for user interaction (enables AskUser tool)
   *
   * When provided, the agent will have access to the AskUser tool,
   * allowing it to ask questions and get responses from the user.
   *
   * @param question - The question to ask
   * @param options - Optional choices for the user
   * @returns User's response, or null if cancelled
   */
  onAskUser?: (
    question: string,
    options?: Array<{ label: string; value: string; description?: string }>
  ) => Promise<string | null>;

  /**
   * Multi-model provider configuration (optional)
   *
   * When specified, uses the new unified provider interface instead of
   * the default OpenAI client. Supports OpenAI, Anthropic, Google Gemini,
   * and OpenAI-compatible APIs.
   *
   * @example
   * ```typescript
   * // Use Anthropic Claude
   * const agent = createAgent({
   *   provider: {
   *     provider: 'anthropic',
   *     apiKey: process.env.ANTHROPIC_API_KEY,
   *   },
   *   model: 'claude-3-5-sonnet-20241022',
   * });
   *
   * // Use Ollama locally
   * const agent = createAgent({
   *   provider: {
   *     provider: 'openai-compatible',
   *     baseURL: 'http://localhost:11434/v1',
   *   },
   *   model: 'llama3.2',
   * });
   * ```
   */
  provider?: ProviderConfig;
}

/**
 * Permission configuration for Agent
 */
export interface AgentPermissionConfig {
  /** Whether to enable permission checking (default: true if config provided) */
  enabled?: boolean;
  /** Default permission level for unmatched tools (default: 'confirm') */
  defaultLevel?: PermissionLevel;
  /** Permission rules (evaluated in order, first match wins) */
  rules?: PermissionRule[];
  /** Whether to remember approved tools for the session (default: true) */
  sessionMemory?: boolean;
  /** Category-level defaults */
  categoryDefaults?: Partial<Record<ToolCategory, PermissionLevel>>;
  /** Confirmation callback (required for 'confirm' level tools) */
  onConfirm?: (request: ConfirmationRequest) => Promise<ConfirmationResponse>;
  /** Callback when a tool is denied */
  onDeny?: (toolName: string, args: Record<string, unknown>, reason: string) => void;
  /** Callback after tool execution (for audit logging) */
  onExecute?: (toolName: string, args: Record<string, unknown>, result: string, allowed: boolean) => void;
}

// =============================================================================
// Tool Types (Enhanced with Anthropic's "Poka-yoke your tools" principle)
// =============================================================================

/**
 * Tool usage example for documentation
 */
export interface ToolExample {
  /** Example input arguments */
  input: Record<string, unknown>;
  /** Expected output */
  output: string;
  /** Description of what this example demonstrates */
  description?: string;
}

/**
 * Enhanced Tool interface with rich documentation
 *
 * Based on Anthropic's "Poka-yoke your tools" principle:
 * - Provide clear examples
 * - Document edge cases
 * - Give hints for proper usage
 */
export interface Tool {
  /** Tool name (must be unique, use snake_case) */
  name: string;

  /**
   * Description of what the tool does.
   * Should be detailed enough for LLM to understand when to use it.
   * Include: purpose, when to use, what it returns.
   */
  description: string;

  /** JSON Schema for tool parameters */
  parameters: Record<string, unknown>;

  /** Function to execute when tool is called */
  execute: (args: Record<string, unknown>) => Promise<string>;

  // ========== Enhanced Documentation ==========

  /**
   * Usage examples showing input/output pairs.
   * LLM can learn from these examples how to use the tool correctly.
   * Recommend: 2-3 examples covering common cases.
   */
  examples?: ToolExample[];

  /**
   * Edge cases and potential pitfalls.
   * Help LLM avoid common mistakes.
   * Example: "Returns empty string if file doesn't exist"
   */
  edgeCases?: string[];

  /**
   * Usage hints and best practices.
   * Example: "Prefer glob patterns over recursive directory listing"
   */
  hints?: string[];

  /**
   * Description of return value format.
   * Example: "Returns JSON with {files: string[], count: number}"
   */
  returnFormat?: string;

  /**
   * Constraints and limitations.
   * Example: "Max file size: 10MB", "Timeout: 30s"
   */
  constraints?: string[];

  /**
   * Related tools that might be useful together.
   * Example: ["grep", "read"] for a "glob" tool
   */
  relatedTools?: string[];

  /**
   * When NOT to use this tool.
   * Help LLM choose the right tool.
   * Example: "Don't use for binary files, use read_binary instead"
   */
  antiPatterns?: string[];
}

export interface AgentResponse {
  /** The agent's response content */
  content: string;
  /** Tool calls made during the response (if any) */
  toolCalls?: ToolCallResult[];
  /** Total tokens used */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ToolCallResult {
  /** Tool name */
  name: string;
  /** Arguments passed to the tool */
  args: Record<string, unknown>;
  /** Result from the tool execution */
  result: string;
}

// =============================================================================
// Plan Types (Transparency support)
// =============================================================================

/**
 * A step in the agent's execution plan
 */
export interface PlanStep {
  /** Step identifier */
  id: string;
  /** Description of what this step does */
  description: string;
  /** Current status of the step */
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  /** Tools that may be used in this step */
  toolsToUse?: string[];
  /** Estimated duration */
  estimatedDuration?: string;
  /** Result when completed */
  result?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Agent's execution plan
 */
export interface AgentPlan {
  /** High-level goal description */
  goal: string;
  /** Ordered list of steps */
  steps: PlanStep[];
  /** Reasoning behind the plan */
  reasoning?: string;
}

export interface StreamCallbacks {
  /** Called for each token received */
  onToken?: (token: string) => void;
  /** Called when a tool is being called */
  onToolCall?: (name: string, args: Record<string, unknown>) => void;
  /** Called when a tool returns a result */
  onToolResult?: (name: string, result: string) => void;
  /** Called when streaming completes */
  onComplete?: (response: AgentResponse) => void;
  /** Called on error */
  onError?: (error: Error) => void;

  // ========== Transparency Callbacks ==========

  /** Called when agent starts thinking/reasoning */
  onThinkingStart?: () => void;
  /** Called with agent's thought process */
  onThinking?: (thought: string, category?: 'analysis' | 'planning' | 'decision' | 'reflection') => void;
  /** Called when thinking phase ends */
  onThinkingEnd?: (summary?: string) => void;

  /** Called when agent creates an execution plan */
  onPlan?: (plan: AgentPlan) => void;
  /** Called when a plan step starts */
  onPlanStepStart?: (step: PlanStep) => void;
  /** Called when a plan step completes */
  onPlanStepComplete?: (stepId: string, result: string) => void;
  /** Called when a plan step fails */
  onPlanStepFail?: (stepId: string, error: string) => void;
  /** Called when plan is modified during execution */
  onPlanUpdate?: (update: { reason: string; steps: PlanStep[] }) => void;
}

export type Message = ChatCompletionMessageParam;

/**
 * Information passed to the onMaxIterations callback
 */
export interface MaxIterationsInfo {
  /** Current iteration count */
  currentIterations: number;
  /** Maximum iterations limit */
  maxIterations: number;
  /** Number of tool calls executed so far */
  toolCallCount: number;
}

/**
 * Callback when max iterations is reached.
 * Return true to continue execution, false to stop gracefully.
 */
export type OnMaxIterationsCallback = (info: MaxIterationsInfo) => Promise<boolean>;

export interface ConversationOptions {
  /** Maximum number of tool call iterations */
  maxIterations?: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /**
   * Callback when max iterations is reached.
   * Return true to continue (resets iteration counter), false to stop gracefully.
   * If not provided, an error will be thrown when max iterations is reached.
   */
  onMaxIterations?: OnMaxIterationsCallback;
}

// =============================================================================
// Tool Execution Configuration
// =============================================================================

/**
 * Configuration for parallel tool execution
 */
export interface ToolExecutionConfig {
  /**
   * Maximum number of tools to execute concurrently
   * @default Infinity (no limit)
   */
  maxConcurrentTools?: number;

  /**
   * Timeout for individual tool execution (in milliseconds)
   * @default 30000 (30 seconds)
   */
  toolTimeout?: number;

  /**
   * Whether to execute tools in parallel when possible
   * @default true
   */
  parallelExecution?: boolean;
}

/**
 * Default tool execution configuration
 */
export const DEFAULT_TOOL_EXECUTION_CONFIG: Required<ToolExecutionConfig> = {
  maxConcurrentTools: Infinity,
  toolTimeout: 30000,
  parallelExecution: true,
};

// =============================================================================
// Observability / Events
// =============================================================================

/**
 * Agent event types
 */
export type AgentEventType =
  | 'tool:start'
  | 'tool:end'
  | 'tool:error'
  | 'llm:request'
  | 'llm:response'
  | 'llm:stream:start'
  | 'llm:stream:token'
  | 'llm:stream:end'
  | 'memory:retrieve'
  | 'memory:record'
  | 'iteration:start'
  | 'iteration:end'
  // Transparency events
  | 'thinking:start'
  | 'thinking:update'
  | 'thinking:end'
  | 'plan:created'
  | 'plan:step:start'
  | 'plan:step:complete'
  | 'plan:step:failed'
  | 'plan:updated';

/**
 * Base event data
 */
export interface AgentEventBase {
  /** Event type */
  type: AgentEventType;
  /** Timestamp when event occurred */
  timestamp: number;
  /** Session ID if memory is enabled */
  sessionId?: string;
}

/**
 * Tool execution started
 */
export interface ToolStartEvent extends AgentEventBase {
  type: 'tool:start';
  toolName: string;
  args: Record<string, unknown>;
  toolCallId: string;
}

/**
 * Tool execution completed
 */
export interface ToolEndEvent extends AgentEventBase {
  type: 'tool:end';
  toolName: string;
  result: string;
  toolCallId: string;
  durationMs: number;
}

/**
 * Tool execution error
 */
export interface ToolErrorEvent extends AgentEventBase {
  type: 'tool:error';
  toolName: string;
  error: string;
  toolCallId: string;
  durationMs: number;
}

/**
 * LLM request started
 */
export interface LLMRequestEvent extends AgentEventBase {
  type: 'llm:request';
  model: string;
  messageCount: number;
  toolCount: number;
}

/**
 * LLM response received
 */
export interface LLMResponseEvent extends AgentEventBase {
  type: 'llm:response';
  model: string;
  hasToolCalls: boolean;
  toolCallCount: number;
  contentLength: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  durationMs: number;
}

/**
 * Iteration started
 */
export interface IterationStartEvent extends AgentEventBase {
  type: 'iteration:start';
  iteration: number;
  maxIterations: number;
}

/**
 * Iteration completed
 */
export interface IterationEndEvent extends AgentEventBase {
  type: 'iteration:end';
  iteration: number;
  toolCallCount: number;
  durationMs: number;
}

// =============================================================================
// Transparency Events
// =============================================================================

/**
 * Agent started thinking/reasoning
 */
export interface ThinkingStartEvent extends AgentEventBase {
  type: 'thinking:start';
}

/**
 * Agent's thought process update
 */
export interface ThinkingUpdateEvent extends AgentEventBase {
  type: 'thinking:update';
  thought: string;
  category?: 'analysis' | 'planning' | 'decision' | 'reflection';
}

/**
 * Agent finished thinking
 */
export interface ThinkingEndEvent extends AgentEventBase {
  type: 'thinking:end';
  summary?: string;
}

/**
 * Agent created an execution plan
 */
export interface PlanCreatedEvent extends AgentEventBase {
  type: 'plan:created';
  goal: string;
  steps: PlanStep[];
  reasoning?: string;
}

/**
 * Plan step started
 */
export interface PlanStepStartEvent extends AgentEventBase {
  type: 'plan:step:start';
  stepId: string;
  description: string;
}

/**
 * Plan step completed
 */
export interface PlanStepCompleteEvent extends AgentEventBase {
  type: 'plan:step:complete';
  stepId: string;
  result: string;
}

/**
 * Plan step failed
 */
export interface PlanStepFailedEvent extends AgentEventBase {
  type: 'plan:step:failed';
  stepId: string;
  error: string;
  willRetry: boolean;
}

/**
 * Plan was updated during execution
 */
export interface PlanUpdatedEvent extends AgentEventBase {
  type: 'plan:updated';
  reason: string;
  addedSteps?: PlanStep[];
  removedStepIds?: string[];
  modifiedSteps?: Array<{ id: string; changes: Partial<PlanStep> }>;
}

/**
 * Union of all agent events
 */
export type AgentEvent =
  | ToolStartEvent
  | ToolEndEvent
  | ToolErrorEvent
  | LLMRequestEvent
  | LLMResponseEvent
  | IterationStartEvent
  | IterationEndEvent
  // Transparency events
  | ThinkingStartEvent
  | ThinkingUpdateEvent
  | ThinkingEndEvent
  | PlanCreatedEvent
  | PlanStepStartEvent
  | PlanStepCompleteEvent
  | PlanStepFailedEvent
  | PlanUpdatedEvent;

/**
 * Event listener function
 */
export type AgentEventListener = (event: AgentEvent) => void;

/**
 * Telemetry configuration
 */
export interface TelemetryConfig {
  /** Enable event emission (default: false) */
  enabled?: boolean;
  /** Event listener function */
  onEvent?: AgentEventListener;
  /** Log level for built-in console logging */
  logLevel?: 'none' | 'error' | 'warn' | 'info' | 'debug';
}

// =============================================================================
// Stop Conditions (Extended execution control)
// =============================================================================

/**
 * Execution context for stop condition evaluation
 */
export interface ExecutionContext {
  /** Current iteration count */
  iterations: number;
  /** All tool calls executed */
  toolCalls: ToolCallResult[];
  /** Total tool call count */
  toolCallCount: number;
  /** Total tokens consumed (prompt + completion) */
  totalTokens: number;
  /** Total prompt tokens */
  promptTokens: number;
  /** Total completion tokens */
  completionTokens: number;
  /** Elapsed time in milliseconds */
  elapsedMs: number;
  /** Estimated cost in USD (if pricing configured) */
  estimatedCost?: number;
  /** Current plan steps status */
  planProgress?: {
    total: number;
    completed: number;
    failed: number;
  };
  /** Last assistant response */
  lastResponse?: string;
}

/**
 * Result of stop condition check
 */
export interface StopCheckResult {
  /** Whether to stop execution */
  shouldStop: boolean;
  /** Reason for stopping (for logging/display) */
  reason?: string;
  /** Whether this is a soft stop (can be overridden) or hard stop */
  type: 'soft' | 'hard';
  /** Suggested action */
  suggestion?: 'continue' | 'pause' | 'abort';
}

/**
 * Flexible stop conditions for agent execution
 */
export interface StopConditions {
  // ========== Iteration Limits ==========

  /** Maximum LLM call iterations (default: 10) */
  maxIterations?: number;

  /** Maximum tool calls across all iterations */
  maxToolCalls?: number;

  // ========== Resource Limits ==========

  /** Maximum total tokens (prompt + completion) */
  maxTotalTokens?: number;

  /** Maximum completion tokens only */
  maxCompletionTokens?: number;

  /** Maximum execution time in milliseconds */
  maxDurationMs?: number;

  // ========== Cost Limits ==========

  /** Maximum estimated cost in USD */
  maxCost?: number;

  /** Pricing configuration for cost calculation */
  pricing?: {
    /** Cost per 1K prompt tokens */
    promptTokenCost: number;
    /** Cost per 1K completion tokens */
    completionTokenCost: number;
  };

  // ========== Content-based Conditions ==========

  /** Stop if response contains any of these patterns */
  stopPatterns?: Array<string | RegExp>;

  /** Stop if specific tool is called */
  stopOnTools?: string[];

  /** Stop if tool call fails N times consecutively */
  maxConsecutiveFailures?: number;

  // ========== Custom Conditions ==========

  /**
   * Custom stop condition function.
   * Called after each iteration.
   * Return true to stop, false to continue.
   */
  customCondition?: (context: ExecutionContext) => boolean | StopCheckResult;

  /**
   * Async custom condition (for external checks)
   */
  asyncCondition?: (context: ExecutionContext) => Promise<boolean | StopCheckResult>;

  // ========== Callbacks ==========

  /**
   * Called when a stop condition is triggered.
   * Return true to override and continue, false to stop.
   */
  onStopCondition?: (result: StopCheckResult, context: ExecutionContext) => Promise<boolean>;

  /**
   * Called periodically with execution stats (for monitoring)
   */
  onProgress?: (context: ExecutionContext) => void;
}

/**
 * Default stop conditions
 */
export const DEFAULT_STOP_CONDITIONS: Partial<StopConditions> = {
  maxIterations: 10,
  maxDurationMs: 5 * 60 * 1000, // 5 minutes
  maxConsecutiveFailures: 3,
};

// =============================================================================
// Planning Configuration
// =============================================================================

/**
 * Planning mode configuration
 */
export interface PlanningConfig {
  /** Enable explicit planning phase before execution */
  enabled?: boolean;

  /**
   * Planning mode:
   * - 'implicit': Extract plan from model's natural response
   * - 'explicit': Request structured plan via system prompt
   * - 'tool': Use a dedicated planning tool
   */
  mode?: 'implicit' | 'explicit' | 'tool';

  /** Show plan to user before execution */
  showPlanBeforeExecution?: boolean;

  /** Require user approval before executing plan */
  requireApproval?: boolean;

  /** Allow plan modification during execution */
  allowDynamicReplanning?: boolean;

  /** Custom system prompt addition for planning */
  planningPrompt?: string;
}
