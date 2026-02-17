/**
 * @agent-stack/index
 *
 * Main entry point for agent-stack AI agents
 */

// Agent - main export
export { createAgent, type AgentInstance } from './agent';
export * from './types';
export * from './config';

// Re-export useful types and factory functions from provider
export {
  createOpenAIClient,
  systemMessage,
  userMessage,
  assistantMessage,
  toolMessage,
  defineTool,
  defineParameters,
  type OpenAIClientInstance,
  type ChatModel,
  type ChatCompletionMessageParam,
} from '@agent-stack/provider';

// Re-export MCP types and factory functions for convenience
export {
  createMCPClientManager,
  createMCPToolProvider,
  loadConfig as loadMCPConfig,
  type MCPClientManagerInstance,
  type MCPToolProviderInstance,
  type MCPConfig,
  type MCPServerConfig,
  type MCPTool,
  type MCPResource,
  type MCPToolBridgeOptions,
  type BridgedTool,
} from '@agent-stack/mcp';

// Re-export Skill types and factory functions for convenience
export {
  createSkillManager,
  createSkillToolProvider,
  loadConfig as loadSkillConfig,
  discoverSkills,
  type SkillManagerInstance,
  type SkillToolProviderInstance,
  type SkillConfig,
  type SkillEntry,
  type SkillDefinition,
  type SkillToolDefinition,
  type SkillToolBridgeOptions,
  type BridgedSkillTool,
  type LoadedSkill,
  type SkillState,
} from '@agent-stack/skill';

// Re-export Memory types and factory functions for convenience
export {
  // Manager
  createMemoryManager,
  type MemoryManagerInstance,
  // Components
  createMemoryObserver,
  createMemoryRetriever,
  createMemoryInjector,
  createMemoryBudgeter,
  createWritePolicyEngine,
  createMemorySummarizer,
  // Task reducer (already functional)
  TaskStateReducer,
  TaskActions,
  // Stores
  createEventStore,
  createTaskStateStore,
  createSummaryStore,
  createProfileStore,
  createSemanticStore,
  // Types
  type IMemoryObserver,
  type IMemoryRetriever,
  type IMemoryInjector,
  type IMemoryBudgeter,
  type IWritePolicyEngine,
  type IMemorySummarizer,
  type EventStoreInstance,
  type TaskStateStoreInstance,
  type SummaryStoreInstance,
  type ProfileStoreInstance,
  type SemanticStoreInstance,
  type MemoryConfig,
  type MemoryBundle,
  type MemoryEvent,
  type EventInput,
  type EventType,
  type TaskState,
  type TaskStep,
  type TaskConstraint,
  type TaskStateUpdate,
  type TaskAction,
  type Summary,
  type ProfileItem,
  type SemanticChunk,
  type SemanticSearchResult,
  type TokenBudget,
  type WritePolicyConfig,
  type RetrievalConfig,
} from '@agent-stack/memory';
