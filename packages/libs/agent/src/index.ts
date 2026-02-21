/**
 * @ai-stack/agent
 *
 * Main entry point for ai-stack AI agents
 */

// Agent - main export
export { createAgent, type AgentInstance } from './agent.js';
export * from './types.js';
export * from './config.js';

// Tool documentation (Anthropic's "Poka-yoke your tools")
export {
  generateToolDescription,
  toolToFunctionDef,
  toolsToFunctionDefs,
  generateMinimalDescription,
  estimateToolDescriptionTokens,
  optimizeToolsForBudget,
} from './tool-docs.js';

// Stop condition checker
export {
  createStopChecker,
  createExecutionContext,
  type StopCheckerInstance,
} from './stop-checker.js';

// Task completion detector
export {
  createTaskCompletionDetector,
  DEFAULT_COMPLETION_PATTERNS,
  DEFAULT_INCOMPLETE_PATTERNS,
  DEFAULT_TASK_COMPLETION_CONFIG,
  COMPLETION_DETECTION_PROMPT,
  type TaskCompletionDetectorInstance,
  type TaskCompletionDetectorConfig,
  type TaskCompletionResult,
  type TaskCompletionContext,
  type CompletionLLMFn,
} from './task-completion.js';

// Plan parser (transparency support)
export {
  parsePlan,
  detectStepCompletion,
  detectStepStart,
  createPlanTracker,
  DEFAULT_PLANNING_PROMPT,
  type StepCompletion,
  type PlanTrackerInstance,
} from './plan-parser.js';

// State machine (Orchestrator layer)
export {
  createStateMachine,
  VALID_TRANSITIONS,
  DEFAULT_STATE_MACHINE_CONFIG,
  type StateMachineInstance,
  type AgentStatus,
  type AgentState,
  type AgentError,
  type StateTransition,
  type StateMachineConfig,
  type CheckpointInfo,
  type CheckpointStorage,
  type PlanDAGRef,
  type SerializedMessage,
} from './state-machine/index.js';

// Recovery policy (Orchestrator layer)
export {
  createRecoveryPolicy,
  createApiRecoveryPolicy,
  createToolRecoveryPolicy,
  createResilientRecoveryPolicy,
  ERROR_PATTERNS,
  DEFAULT_RECOVERY_CONFIG,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  type RecoveryPolicyInstance,
  type BackoffStrategy,
  type BackoffFunction,
  type RecoveryAction,
  type RecoveryContext,
  type ErrorCategory,
  type ErrorClassifier,
  type RecoveryPolicyConfig,
  type CircuitState,
  type CircuitBreakerConfig,
  type CircuitBreakerState,
} from './recovery/index.js';

// Planner (Planner layer)
export {
  createPlanDAG,
  createPlanner,
  createRuleBasedPlanner,
  DEFAULT_PLAN_PROMPT,
  REPLAN_PROMPT,
  DECOMPOSE_PROMPT,
  DEFAULT_PLANNER_CONFIG,
  type PlanDAGInstance,
  type PlannerInstance,
  type LLMChatFn,
  type PlanNodeStatus,
  type PlanNode,
  type PlanStatus,
  type PlanDAG,
  type PlanProgress,
  type PlanningMode,
  type PlannerConfig,
  type PlanContext,
  type PlanEventType,
  type PlanEvent,
  type PlanEventListener,
} from './planner/index.js';

// Evaluator (Evaluator layer)
export {
  createEvaluator,
  createSimpleEvaluator,
  createRuleBasedEvaluator,
  DEFAULT_EVAL_PROMPT,
  DEFAULT_SELF_CHECK_PROMPT,
  DEFAULT_CRITERIA,
  DEFAULT_EVALUATOR_CONFIG,
  type EvaluatorInstance,
  type EvaluationDimension,
  type CustomCriterion,
  type EvaluationCriteria,
  type ToolResultForEval,
  type EvalContext,
  type EvaluationResult,
  type SelfCheckResult,
  type EvaluatorConfig,
} from './evaluator/index.js';

// Model Router (Model layer)
export {
  createModelRouter,
  createOpenAIRouter,
  createAnthropicRouter,
  DEFAULT_TASK_TIER_MAP,
  DEFAULT_MODEL_TIERS,
  type ModelRouterInstance,
  type TaskComplexity,
  type TaskType,
  type ModelTierName,
  type ModelTier,
  type RoutingContext,
  type RoutingDecision,
  type TokenUsage,
  type TierCostStats,
  type CostStats,
  type ModelRouterConfig,
} from './router/index.js';

// Metrics (Observability layer)
export {
  createMetricsAggregator,
  DEFAULT_METRICS_CONFIG,
  type MetricsAggregatorInstance,
  type MetricPoint,
  type LatencyPoint,
  type CostPoint,
  type ErrorPoint,
  type ToolCallPoint,
  type TokenPoint,
  type LatencyStats,
  type CostMetrics,
  type ThroughputMetrics,
  type ErrorMetrics,
  type ToolMetrics,
  type AggregatedMetrics,
  type AlertSeverity,
  type AlertCondition,
  type Alert,
  type MetricsConfig,
} from './metrics/index.js';

// Guardrail (Safety layer)
export {
  createGuardrail,
  createPIIRule,
  createSecretsRule,
  createDangerousCommandsRule,
  createInjectionRule,
  createLengthRule,
  getBuiltInRules,
  DEFAULT_GUARDRAIL_CONFIG,
  type GuardrailInstance,
  type GuardrailRuleType,
  type GuardrailSeverity,
  type GuardrailContext,
  type GuardrailResult,
  type GuardrailRule,
  type GuardrailConfig,
  type BuiltInRuleCategory,
  type BuiltInRuleOptions,
} from './guardrail/index.js';

// Sub-Agent (Orchestration layer)
export {
  createSubAgentManager,
  DEFAULT_SUB_AGENT_MANAGER_CONFIG,
  type SubAgentManagerInstance,
  type AgentFactory,
  type SubAgentLike,
  type SubAgentConfig,
  type SubAgentTask,
  type SubAgentTaskStatus,
  type SubAgentResult,
  type SubAgentDAG,
  type SubAgentManagerConfig,
} from './sub-agent/index.js';

// Built-in tools
export {
  createAskUserTool,
  type AskUserOption,
  type AskUserParams,
  type OnAskUserCallback,
} from './tools/index.js';

// Tool Orchestrator
export {
  createToolOrchestrator,
  DEFAULT_TOOL_ORCHESTRATOR_CONFIG,
  type PlannerLLMFn,
  type ToolOrchestratorConfig,
  type ToolOrchestratorInstance,
  type ToolChain,
  type ToolChainStep,
  type ToolChainResult,
  type ToolMetadata,
  type PlanningContext,
  type ExecutionContext as OrchestratorExecutionContext,
} from './tool-orchestrator/index.js';

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
