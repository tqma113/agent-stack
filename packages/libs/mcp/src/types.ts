/**
 * @ai-stack/mcp - Type Definitions
 */

// ============================================
// Configuration Types (mcp.json format)
// ============================================

/**
 * Transport type for MCP server connections
 */
export type MCPTransportType = 'stdio' | 'http' | 'sse';

/**
 * Stdio transport configuration (local process)
 * Default when 'type' is not specified
 */
export interface MCPStdioServerConfig {
  type?: 'stdio';
  /** Command to execute (e.g., 'npx', 'bunx', 'node') */
  command: string;
  /** Command arguments */
  args?: string[];
  /** Environment variables to pass to the server */
  env?: Record<string, string>;
  /** Working directory for the process */
  cwd?: string;
  /** Connection timeout in milliseconds */
  timeout?: number;
}

/**
 * HTTP transport configuration (remote server)
 */
export interface MCPHttpServerConfig {
  type: 'http';
  /** Server URL endpoint */
  url: string;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Connection timeout in milliseconds */
  timeout?: number;
}

/**
 * SSE transport configuration (legacy/deprecated)
 */
export interface MCPSseServerConfig {
  type: 'sse';
  /** Server URL endpoint */
  url: string;
  /** Connection timeout in milliseconds */
  timeout?: number;
}

/**
 * Union type for all server configurations
 */
export type MCPServerConfig =
  | MCPStdioServerConfig
  | MCPHttpServerConfig
  | MCPSseServerConfig;

/**
 * Root configuration file format (mcp.json)
 */
export interface MCPConfig {
  /** Map of server name to configuration */
  mcpServers: Record<string, MCPServerConfig>;
}

// ============================================
// MCP Protocol Types
// ============================================

/**
 * MCP Tool definition from server
 */
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * MCP Resource definition from server
 */
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * MCP Resource content
 */
export interface MCPResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string; // Base64 encoded
}

/**
 * MCP Prompt definition from server
 */
export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: MCPPromptArgument[];
}

/**
 * MCP Prompt argument
 */
export interface MCPPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

/**
 * MCP Prompt message
 */
export interface MCPPromptMessage {
  role: 'user' | 'assistant';
  content: {
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
    resource?: { uri: string };
  };
}

/**
 * Tool call result from MCP server
 */
export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

// ============================================
// Client Manager Types
// ============================================

/**
 * Connection state for an MCP server
 */
export type MCPConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

/**
 * Server connection info
 */
export interface MCPServerConnection {
  name: string;
  config: MCPServerConfig;
  state: MCPConnectionState;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
  error?: Error;
}

/**
 * Options for MCPClientManager
 */
export interface MCPClientManagerOptions {
  /** Callback when connection state changes */
  onConnectionChange?: (
    serverName: string,
    state: MCPConnectionState,
    error?: Error
  ) => void;
  /** Callback when tools list changes */
  onToolsChange?: (serverName: string, tools: MCPTool[]) => void;
  /** Default timeout for all servers (ms) */
  defaultTimeout?: number;
}

/**
 * Options for tool execution
 */
export interface MCPToolCallOptions {
  /** Timeout for this specific call (ms) */
  timeout?: number;
  /** Abort signal */
  signal?: AbortSignal;
}

// ============================================
// Bridge Types
// ============================================

/**
 * Agent Tool interface (from @ai-stack/agent)
 * Duplicated here to avoid circular dependency
 */
export interface AgentTool {
  /** Tool name (must be unique) */
  name: string;
  /** Description of what the tool does */
  description: string;
  /** JSON Schema for tool parameters */
  parameters: Record<string, unknown>;
  /** Function to execute when tool is called */
  execute: (args: Record<string, unknown>) => Promise<string>;
}

/**
 * Options for converting MCP tools to Agent tools
 */
export interface MCPToolBridgeOptions {
  /** Prefix to add to tool names (e.g., "mcp_") */
  namePrefix?: string;
  /** Whether to include server name in tool name */
  includeServerName?: boolean;
  /** Custom name transformer */
  nameTransformer?: (serverName: string, toolName: string) => string;
  /** Filter function to include/exclude tools */
  filter?: (serverName: string, tool: MCPTool) => boolean;
}

/**
 * Bridged tool with metadata
 */
export interface BridgedTool extends AgentTool {
  /** Original MCP tool name */
  mcpToolName: string;
  /** Server this tool belongs to */
  mcpServerName: string;
}

// ============================================
// Event Types
// ============================================

export type MCPEventType =
  | 'connection:change'
  | 'tools:change'
  | 'resources:change'
  | 'error';

export interface MCPEvent {
  type: MCPEventType;
  serverName: string;
  data?: unknown;
  error?: Error;
}

export type MCPEventHandler = (event: MCPEvent) => void;

// ============================================
// Error Types
// ============================================

/**
 * Base MCP error class
 */
export class MCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public serverName?: string
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

/**
 * Connection error
 */
export class MCPConnectionError extends MCPError {
  constructor(serverName: string, cause?: Error) {
    super(
      `Failed to connect to MCP server: ${serverName}`,
      'CONNECTION_ERROR',
      serverName
    );
    this.cause = cause;
  }
}

/**
 * Tool execution error
 */
export class MCPToolExecutionError extends MCPError {
  constructor(serverName: string, toolName: string, cause?: Error) {
    super(
      `Tool execution failed: ${toolName} on ${serverName}`,
      'TOOL_EXECUTION_ERROR',
      serverName
    );
    this.cause = cause;
  }
}

/**
 * Configuration error
 */
export class MCPConfigurationError extends MCPError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR');
  }
}

/**
 * Timeout error
 */
export class MCPTimeoutError extends MCPError {
  constructor(operation: string, serverName?: string) {
    super(`Operation timed out: ${operation}`, 'TIMEOUT_ERROR', serverName);
  }
}
