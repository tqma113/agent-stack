/**
 * Agent Types
 */

import type { ChatCompletionMessageParam } from '@agent-stack/provider';
import type { MCPToolBridgeOptions } from '@agent-stack/mcp';

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
