/**
 * @agent-stack/index
 *
 * Main entry point for agent-stack AI agents
 */

export { Agent } from './agent';
export * from './types';

// Re-export useful types from provider
export {
  OpenAIClient,
  systemMessage,
  userMessage,
  assistantMessage,
  toolMessage,
  defineTool,
  defineParameters,
  type ChatModel,
  type ChatCompletionMessageParam,
} from '@agent-stack/provider';

// Re-export MCP types and classes for convenience
export {
  MCPClientManager,
  MCPToolProvider,
  loadConfig as loadMCPConfig,
  type MCPConfig,
  type MCPServerConfig,
  type MCPTool,
  type MCPResource,
  type MCPToolBridgeOptions,
  type BridgedTool,
} from '@agent-stack/mcp';
