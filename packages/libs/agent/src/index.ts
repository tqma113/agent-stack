/**
 * @ai-stack/agent
 *
 * Main entry point for ai-stack AI agents
 */

// Agent - main export
export { createAgent, type AgentInstance } from './agent.js';
export * from './types.js';
export * from './config.js';

// Re-export TUI for convenience
export {
  // Theme and colors
  theme,
  icons,
  borders,
  legacyColors,
  // Terminal utilities
  getTerminalWidth,
  getTerminalHeight,
  isTTY,
  supportsColor,
  // Spinners
  createThinkingSpinner,
  createLoadingSpinner,
  createToolSpinner,
  createSpinner,
  createLegacySpinner,
  // Render utilities
  renderMessage,
  renderStatusBox,
  renderToolCall,
  renderToolCallInline,
  renderHeader,
  renderHeaderLine,
  renderFooter,
  renderWelcome,
  renderDivider,
  renderPrompt,
  renderAgentPrefix,
  // Stream renderer
  StreamRenderer,
  createStreamRenderer,
  // Adapters
  showConfirm,
  showSelect,
  showDiffView,
  // Types
  type Role,
  type Message,
  type ToolCallInfo,
  type StreamState,
  type RenderOptions,
} from '@ai-stack/tui';

// Permission system
export {
  createPermissionPolicy,
  DEFAULT_RULES,
  DEFAULT_CATEGORY_PATTERNS,
  DEFAULT_PERMISSION_CONFIG,
  type PermissionLevel,
  type ToolCategory,
  type PermissionRule,
  type PermissionDecision,
  type ConfirmationRequest,
  type ConfirmationResponse,
  type PermissionPolicyConfig,
  type PermissionCallback,
  type PermissionAuditEntry,
  type PermissionPolicyInstance,
} from './permission/index.js';

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
} from '@ai-stack/provider';

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
} from '@ai-stack/mcp';

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
} from '@ai-stack/skill';

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
} from '@ai-stack/memory';

// Re-export Knowledge types and factory functions for convenience
export {
  // Manager
  createKnowledgeManager,
  type KnowledgeManagerInstance,
  // Indexers
  createCodeIndexer,
  createDocIndexer,
  type CodeIndexerInstance,
  type DocIndexerInstance,
  // Search
  createHybridSearch,
  type HybridSearchInstance,
  // Types
  type KnowledgeSourceType,
  type KnowledgeChunk,
  type KnowledgeSearchResult,
  type KnowledgeSearchOptions,
  type KnowledgeManagerConfig,
  type KnowledgeStats,
  type CodeBlock,
  type CodeSymbolType,
  type CodeIndexerConfig,
  type CodeSearchOptions,
  type IndexStatus,
  type IndexResult,
  type IndexSummary,
  type IndexStatusSummary,
  type DocSource,
  type DocSourceInput,
  type DocSourceType,
  type DocPage,
  type DocSection,
  type DocIndexerConfig,
  type DocSearchOptions,
  type CrawlOptions,
  type CrawlResult,
  type CrawlSummary,
} from '@ai-stack/knowledge';
