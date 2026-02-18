/**
 * Agent Types
 */

import type { ChatCompletionMessageParam } from '@ai-stack/provider';
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
  /** OpenAI model to use */
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

export interface Tool {
  /** Tool name (must be unique) */
  name: string;
  /** Description of what the tool does */
  description: string;
  /** JSON Schema for tool parameters */
  parameters: Record<string, unknown>;
  /** Function to execute when tool is called */
  execute: (args: Record<string, unknown>) => Promise<string>;
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
