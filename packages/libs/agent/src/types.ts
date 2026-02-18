/**
 * Agent Types
 */

import type { ChatCompletionMessageParam } from '@ai-stack/provider';
import type { MCPToolBridgeOptions } from '@ai-stack/mcp';
import type { SkillToolBridgeOptions, SkillEntry } from '@ai-stack/skill';
import type { MemoryConfig, TokenBudget, WritePolicyConfig, RetrievalConfig } from '@ai-stack/memory';

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
  /** Database file path (default: '.ai-stack/memory.db') */
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

export interface ConversationOptions {
  /** Maximum number of tool call iterations */
  maxIterations?: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}
