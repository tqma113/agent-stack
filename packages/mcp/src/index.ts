/**
 * @agent-stack/mcp
 *
 * MCP (Model Context Protocol) integration for agent-stack
 */

// Core client
export {
  createMCPClientManager,
  type MCPClientManagerInstance,
} from './client';

// Tool bridge
export {
  createMCPToolProvider,
  createToolBridge,
  bridgeTool,
  createResourceAccessor,
  type MCPResourceAccessor,
  type MCPToolProviderInstance,
} from './bridge';

// Configuration
export {
  loadConfig,
  loadConfigFromDefaults,
  findConfigFile,
  parseConfig,
  getTransportType,
  isStdioConfig,
  isHttpConfig,
  CONFIG_FILE_NAMES,
} from './config';

// Transport
export { createTransport, type MCPTransport } from './transport';

// Types
export type {
  // Configuration types
  MCPConfig,
  MCPServerConfig,
  MCPStdioServerConfig,
  MCPHttpServerConfig,
  MCPSseServerConfig,
  MCPTransportType,
  // Protocol types
  MCPTool,
  MCPResource,
  MCPResourceContent,
  MCPPrompt,
  MCPPromptArgument,
  MCPPromptMessage,
  MCPToolResult,
  // Client types
  MCPConnectionState,
  MCPServerConnection,
  MCPClientManagerOptions,
  MCPToolCallOptions,
  // Bridge types
  MCPToolBridgeOptions,
  BridgedTool,
  AgentTool,
  // Event types
  MCPEventType,
  MCPEvent,
  MCPEventHandler,
} from './types';

// Errors
export {
  MCPError,
  MCPConnectionError,
  MCPToolExecutionError,
  MCPConfigurationError,
  MCPTimeoutError,
} from './types';

// Helpers
export {
  sanitizeToolName,
  generateToolName,
  parseToolResultContent,
  isErrorResult,
  extractTextContent,
  formatErrorResult,
  withTimeout,
  retryWithBackoff,
  sleep,
  deepMerge,
} from './helpers';
