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

// Re-export Skill types and classes for convenience
export {
  SkillManager,
  SkillToolProvider,
  loadConfig as loadSkillConfig,
  discoverSkills,
  type SkillConfig,
  type SkillEntry,
  type SkillDefinition,
  type SkillToolDefinition,
  type SkillToolBridgeOptions,
  type BridgedSkillTool,
  type LoadedSkill,
  type SkillState,
} from '@agent-stack/skill';
