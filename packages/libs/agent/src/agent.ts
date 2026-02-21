/**
 * Agent - Main AI Agent implementation
 */

import {
  createOpenAIClient,
  createProvider,
  systemMessage,
  userMessage,
  assistantMessage,
  toolMessage,
  defineTool,
  type ChatCompletionMessageParam,
  type OpenAIClientInstance,
  type ProviderInstance,
  type UnifiedMessage,
} from '@ai-stack/provider';
import {
  createMCPClientManager,
  createMCPToolProvider,
  type MCPConfig,
  type MCPClientManagerInstance,
  type MCPToolProviderInstance,
} from '@ai-stack/mcp';
import {
  createSkillManager,
  createSkillToolProvider,
  type SkillConfig,
  type SkillManagerInstance,
  type SkillToolProviderInstance,
} from '@ai-stack/skill';
import {
  createMemoryManager,
  TaskStateReducer,
  TaskActions,
  createCompactionManager,
  type MemoryManagerConfig,
  type MemoryBundle,
  type TaskState,
  type TaskStep,
  type TaskConstraint,
  type MemoryManagerInstance,
  type IMemoryObserver,
  type IMemoryBudgeter,
  type MemoryStores,
  type ICompactionManager,
} from '@ai-stack/memory';
import {
  createSqliteStores,
} from '@ai-stack/memory-store-sqlite';
import {
  createKnowledgeManager,
  type KnowledgeManagerInstance,
  type KnowledgeSearchResult,
  type KnowledgeStats,
  type DocSource,
  type DocSourceInput,
  type IndexSummary,
  type CrawlSummary,
} from '@ai-stack/knowledge';
import type {
  AgentConfig,
  AgentMCPConfig,
  AgentSkillConfig,
  AgentMemoryConfig,
  AgentKnowledgeConfig,
  AgentPermissionConfig,
  AgentStateMachineConfig,
  AgentRecoveryConfig,
  AgentPlannerConfig,
  AgentEvaluatorConfig,
  AgentRouterConfig,
  AgentMetricsConfig,
  AgentGuardrailConfig,
  SuperLoopConfig,
  AgentSelfReflectionConfig,
  AgentCompactionConfig,
  Tool,
  AgentResponse,
  ToolCallResult,
  StreamCallbacks,
  ConversationOptions,
  ToolExecutionConfig,
  TelemetryConfig,
  AgentEvent,
  AgentEventType,
  AgentEventListener,
  ExecutionContext,
  StopCheckResult,
} from './types.js';
import {
  DEFAULT_TOOL_EXECUTION_CONFIG,
  DEFAULT_SUPER_LOOP_CONFIG,
  DEFAULT_SELF_REFLECTION_CONFIG,
  DEFAULT_COMPACTION_CONFIG,
} from './types.js';
import {
  createStopChecker,
  createExecutionContext,
  type StopCheckerInstance,
} from './stop-checker.js';
import {
  createTaskCompletionDetector,
  type TaskCompletionDetectorInstance,
} from './task-completion.js';
import {
  createPermissionPolicy,
  type PermissionPolicyInstance,
  type ConfirmationRequest,
  type ConfirmationResponse,
  type PermissionRule,
  type PermissionAuditEntry,
} from './permission/index.js';
import { createAskUserTool } from './tools/ask-user.js';
import type { AgentEventListener as AgentEventListenerType } from './types.js';

// Import architecture modules
import {
  createStateMachine,
  type StateMachineInstance,
  type AgentState,
  type PlanDAGRef,
} from './state-machine/index.js';
import {
  createRecoveryPolicy,
  createApiRecoveryPolicy,
  createToolRecoveryPolicy,
  type RecoveryPolicyInstance,
} from './recovery/index.js';
import {
  createPlanDAG,
  createPlanner,
  type PlanDAGInstance,
  type PlannerInstance,
  type PlanNode,
} from './planner/index.js';
import {
  createEvaluator,
  type EvaluatorInstance,
  type EvalContext as EvalContextType,
} from './evaluator/index.js';

// Re-alias for local use
type EvalContext = EvalContextType;
import {
  createModelRouter,
  type ModelRouterInstance,
  type TaskType,
  type CostStats,
} from './router/index.js';
import {
  createMetricsAggregator,
  type MetricsAggregatorInstance,
  type AggregatedMetrics,
} from './metrics/index.js';
import {
  createGuardrail,
  type GuardrailInstance,
  type GuardrailRule,
  type GuardrailResult,
} from './guardrail/index.js';

const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant. Be concise and helpful in your responses.`;

/**
 * Agent instance type (returned by factory)
 */
export interface AgentInstance {
  // MCP Integration
  initializeMCP(): Promise<void>;
  getMCPManager(): MCPClientManagerInstance | null;
  getMCPToolProvider(): MCPToolProviderInstance | null;
  refreshMCPTools(): Promise<void>;
  closeMCP(): Promise<void>;

  // Skill Integration
  initializeSkills(): Promise<void>;
  getSkillManager(): SkillManagerInstance | null;
  getSkillToolProvider(): SkillToolProviderInstance | null;
  refreshSkillTools(): Promise<void>;
  closeSkills(): Promise<void>;

  // Memory Integration
  initializeMemory(): Promise<void>;
  getMemoryManager(): MemoryManagerInstance | null;
  getCompactionManager(): ICompactionManager | null;
  getSessionId(): string | null;
  newSession(): string | null;
  retrieveMemory(query?: string): Promise<MemoryBundle | null>;
  getMemoryContext(query?: string): Promise<string>;
  triggerCompaction(): Promise<void>;
  closeMemory(): Promise<void>;

  // Knowledge Integration
  initializeKnowledge(): Promise<void>;
  getKnowledgeManager(): KnowledgeManagerInstance | null;
  searchKnowledge(query: string, options?: { sources?: ('code' | 'doc')[]; limit?: number }): Promise<KnowledgeSearchResult[]>;
  searchCode(query: string, options?: { languages?: string[]; limit?: number }): Promise<KnowledgeSearchResult[]>;
  searchDocs(query: string, options?: { sourceIds?: string[]; limit?: number }): Promise<KnowledgeSearchResult[]>;
  getKnowledgeContext(query: string): Promise<string>;
  indexCode(options?: { force?: boolean }): Promise<IndexSummary>;
  addDocSource(source: DocSourceInput): Promise<DocSource>;
  removeDocSource(sourceId: string): Promise<void>;
  crawlDocs(options?: { force?: boolean }): Promise<CrawlSummary>;
  getKnowledgeStats(): Promise<KnowledgeStats>;
  closeKnowledge(): Promise<void>;

  // Task Management
  createTask(goal: string, options?: {
    constraints?: TaskConstraint[];
    plan?: TaskStep[];
  }): Promise<TaskState | null>;
  getCurrentTask(): Promise<TaskState | null>;
  updateTask(taskId: string, update: Partial<TaskState> & { actionId?: string }): Promise<TaskState | null>;
  addTaskStep(step: Omit<TaskStep, 'id' | 'status'>): Promise<TaskState | null>;
  completeTaskStep(stepId: string, result?: string): Promise<TaskState | null>;
  blockTaskStep(stepId: string, reason: string): Promise<TaskState | null>;
  unblockTaskStep(stepId: string): Promise<TaskState | null>;
  getTaskProgress(): Promise<{ percentage: number; done: number; total: number } | null>;
  getNextStep(): Promise<TaskStep | null>;
  setTaskStatus(status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'blocked'): Promise<TaskState | null>;

  // Profile Management
  setProfile(key: string, value: unknown, options?: { confidence?: number; explicit?: boolean; expiresAt?: number }): Promise<unknown | null>;
  getProfile(key: string): Promise<unknown | null>;
  getAllProfiles(): Promise<Record<string, unknown>>;

  // Permission Management
  getPermissionPolicy(): PermissionPolicyInstance | null;
  addPermissionRule(rule: PermissionRule): void;
  removePermissionRule(toolPattern: string): boolean;
  setPermissionCallback(callback: ((request: ConfirmationRequest) => Promise<ConfirmationResponse>) | null): void;
  clearSessionApprovals(): void;
  getPermissionAuditLog(): PermissionAuditEntry[];

  // State Machine (Orchestrator layer)
  getStateMachine(): StateMachineInstance | null;
  getAgentState(): AgentState | null;
  pauseExecution(): void;
  resumeExecution(): void;
  createCheckpoint(name?: string): Promise<string | null>;
  restoreCheckpoint(checkpointId: string): Promise<boolean>;

  // Recovery Policy
  getRecoveryPolicy(): RecoveryPolicyInstance | null;

  // Metrics (Observability layer)
  getMetricsAggregator(): MetricsAggregatorInstance | null;
  getMetrics(): AggregatedMetrics | null;
  resetMetrics(): void;

  // Guardrail (Safety layer)
  getGuardrail(): GuardrailInstance | null;
  addGuardrailRule(rule: GuardrailRule): void;
  removeGuardrailRule(ruleId: string): void;

  // Model Router
  getModelRouter(): ModelRouterInstance | null;
  getCostStats(): CostStats | null;
  resetCostStats(): void;

  // Evaluator
  getEvaluator(): EvaluatorInstance | null;

  // Planner
  getPlanner(): PlannerInstance | null;
  getCurrentPlan(): PlanDAGInstance | null;

  // Resource Management
  close(): Promise<void>;

  // Configuration
  getName(): string;
  configure(config: Partial<AgentConfig>): void;

  // Tool Management
  registerTool(tool: Tool): void;
  registerTools(tools: Tool[]): void;
  removeTool(name: string): boolean;
  getTools(): Tool[];

  // Conversation History
  clearHistory(): void;
  getHistory(): ChatCompletionMessageParam[];
  addMessage(message: ChatCompletionMessageParam): void;

  // Chat Methods
  chat(input: string, options?: ConversationOptions): Promise<AgentResponse>;
  stream(input: string, callbacks?: StreamCallbacks, options?: ConversationOptions): Promise<AgentResponse>;
  complete(prompt: string, systemPromptOverride?: string): Promise<string>;

  // Telemetry
  setEventListener(listener: AgentEventListenerType | null): void;
}

/**
 * Create an Agent instance
 */
export function createAgent(config: AgentConfig = {}): AgentInstance {
  // Private state via closure
  // Support both legacy OpenAI client and new unified provider
  let client: OpenAIClientInstance | null = null;
  let provider: ProviderInstance | null = null;

  if (config.provider) {
    // Use new unified provider
    provider = createProvider(config.provider);
    if (config.model) {
      provider.setDefaultModel(config.model);
    }
  } else {
    // Use legacy OpenAI client (backward compatible)
    client = createOpenAIClient({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
  }

  const agentConfig = {
    name: config.name ?? 'Agent',
    systemPrompt: config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    model: config.model ?? 'gpt-4o',
    temperature: config.temperature ?? 0.7,
    maxTokens: config.maxTokens ?? 4096,
  };

  const tools = new Map<string, Tool>();
  let conversationHistory: ChatCompletionMessageParam[] = [];

  // MCP integration
  let mcpManager: MCPClientManagerInstance | null = null;
  let mcpToolProvider: MCPToolProviderInstance | null = null;
  const mcpConfig: AgentMCPConfig | null = config.mcp ?? null;

  // Skill integration
  let skillManager: SkillManagerInstance | null = null;
  let skillToolProvider: SkillToolProviderInstance | null = null;
  const skillConfig: AgentSkillConfig | null = config.skill ?? null;

  // Memory integration
  let memoryManager: MemoryManagerInstance | null = null;
  const memoryConfig: AgentMemoryConfig | null = config.memory
    ? config.memory === true
      ? { enabled: true }
      : { enabled: true, ...config.memory }
    : null;
  const taskReducer = new TaskStateReducer();

  // Knowledge integration
  let knowledgeManager: KnowledgeManagerInstance | null = null;
  const knowledgeConfig: AgentKnowledgeConfig | null = config.knowledge
    ? config.knowledge === true
      ? { enabled: true }
      : { enabled: true, ...config.knowledge }
    : null;

  // Permission integration
  let permissionPolicy: PermissionPolicyInstance | null = null;
  const permissionConfig: AgentPermissionConfig | null = config.permission
    ? config.permission === true
      ? { enabled: true }
      : { enabled: true, ...config.permission }
    : null;

  // Tool execution configuration
  const toolExecConfig: Required<ToolExecutionConfig> = {
    ...DEFAULT_TOOL_EXECUTION_CONFIG,
    ...config.toolExecution,
  };

  // Telemetry configuration
  const telemetryConfig: TelemetryConfig = config.telemetry ?? {};
  let eventListener: AgentEventListener | undefined = telemetryConfig.onEvent;

  // ==========================================================================
  // Architecture Modules Integration
  // ==========================================================================

  // State Machine (Orchestrator layer)
  let stateMachine: StateMachineInstance | null = null;
  const stateMachineConfig = config.stateMachine;
  if (stateMachineConfig?.enabled) {
    stateMachine = createStateMachine({
      checkpointPath: stateMachineConfig.checkpointPath,
      autoCheckpoint: stateMachineConfig.autoCheckpoint,
      checkpointInterval: stateMachineConfig.checkpointInterval,
      maxWorkingMemorySize: stateMachineConfig.maxWorkingMemorySize,
      includeConversationHistory: stateMachineConfig.includeConversationHistory,
      debug: stateMachineConfig.debug,
      onStateChange: stateMachineConfig.onStateChange as ((state: AgentState, transition: unknown) => void) | undefined,
    });
  }

  // Recovery Policy
  let llmRecovery: RecoveryPolicyInstance | null = null;
  let toolRecovery: RecoveryPolicyInstance | null = null;
  const recoveryConfig = config.recovery;
  if (recoveryConfig?.enabled) {
    llmRecovery = createApiRecoveryPolicy({
      maxRetries: recoveryConfig.maxRetries ?? 3,
      backoffStrategy: recoveryConfig.backoffStrategy ?? 'exponential',
      initialDelayMs: recoveryConfig.initialDelayMs ?? 1000,
      maxDelayMs: recoveryConfig.maxDelayMs ?? 30000,
      circuitBreaker: recoveryConfig.circuitBreaker,
      beforeRetry: recoveryConfig.onError
        ? async (ctx) => recoveryConfig.onError!(ctx.error, ctx.operation, ctx.attempt)
        : undefined,
      onRecovered: recoveryConfig.onRecovered
        ? (ctx) => recoveryConfig.onRecovered!(ctx.error, ctx.operation, ctx.attempt)
        : undefined,
    });
    toolRecovery = createToolRecoveryPolicy({
      maxRetries: Math.min(recoveryConfig.maxRetries ?? 2, 2),
      backoffStrategy: 'linear',
      initialDelayMs: 500,
    });
  }

  // Metrics Aggregator (Observability layer)
  let metricsAggregator: MetricsAggregatorInstance | null = null;
  const metricsConfig = config.metrics;
  if (metricsConfig?.enabled) {
    metricsAggregator = createMetricsAggregator({
      enabled: true,
      retentionPeriodMs: metricsConfig.retentionPeriodMs,
      onExport: metricsConfig.onExport as ((metrics: AggregatedMetrics) => void) | undefined,
      autoExportIntervalMs: metricsConfig.autoExportIntervalMs,
      alerts: metricsConfig.alerts as any,
      onAlert: metricsConfig.onAlert as any,
    });
    if (metricsConfig.autoExportIntervalMs) {
      metricsAggregator.startAutoExport();
    }
  }

  // Guardrail (Safety layer)
  let guardrail: GuardrailInstance | null = null;
  const guardrailConfig = config.guardrail;
  if (guardrailConfig?.enabled) {
    guardrail = createGuardrail({
      enableBuiltInRules: guardrailConfig.enableBuiltInRules ?? true,
      blockOnViolation: guardrailConfig.blockOnViolation ?? true,
      onViolation: guardrailConfig.onViolation
        ? (result, content) => guardrailConfig.onViolation!(result.ruleId, result.message ?? '', content)
        : undefined,
    });
  }

  // Model Router
  let modelRouter: ModelRouterInstance | null = null;
  const routerConfig = config.router;
  if (routerConfig?.enabled) {
    modelRouter = createModelRouter({
      fast: routerConfig.fast ? {
        model: routerConfig.fast.model,
        inputCostPer1K: routerConfig.fast.inputCostPer1K,
        outputCostPer1K: routerConfig.fast.outputCostPer1K,
        maxContext: routerConfig.fast.maxContext,
        supportedTasks: ['tool_selection', 'classification', 'extraction', 'formatting'],
        latencyTier: 2,
        qualityTier: 6,
      } : undefined,
      standard: routerConfig.standard ? {
        model: routerConfig.standard.model,
        inputCostPer1K: routerConfig.standard.inputCostPer1K,
        outputCostPer1K: routerConfig.standard.outputCostPer1K,
        maxContext: routerConfig.standard.maxContext,
        supportedTasks: ['tool_selection', 'classification', 'extraction', 'formatting', 'summarization', 'conversation'],
        latencyTier: 4,
        qualityTier: 8,
      } : undefined,
      strong: routerConfig.strong ? {
        model: routerConfig.strong.model,
        inputCostPer1K: routerConfig.strong.inputCostPer1K,
        outputCostPer1K: routerConfig.strong.outputCostPer1K,
        maxContext: routerConfig.strong.maxContext,
        supportedTasks: ['tool_selection', 'classification', 'extraction', 'formatting', 'summarization', 'conversation', 'code_generation', 'reasoning', 'planning'],
        latencyTier: 5,
        qualityTier: 9,
      } : undefined,
      costOptimization: routerConfig.costOptimization,
      dailyCostLimit: routerConfig.dailyCostLimit,
      onCostWarning: routerConfig.onCostWarning
        ? (stats) => routerConfig.onCostWarning!(stats.totalCost, routerConfig.dailyCostLimit ?? 0)
        : undefined,
      onCostLimitReached: routerConfig.onCostLimitReached
        ? (stats) => routerConfig.onCostLimitReached!(stats.totalCost)
        : undefined,
    });
  }

  // Evaluator
  let evaluator: EvaluatorInstance | null = null;
  const evaluatorConfig = config.evaluator;
  // Evaluator will be initialized later when we have the chat function

  // Planner
  let planner: PlannerInstance | null = null;
  let currentPlan: PlanDAGInstance | null = null;
  const plannerConfig = config.planner;
  // Planner will be initialized later when we have the chat function

  // ==========================================================================
  // Super Loop Configuration
  // ==========================================================================

  // Super loop config
  const superLoopConfig: SuperLoopConfig = {
    ...DEFAULT_SUPER_LOOP_CONFIG,
    ...config.superLoop,
  };

  // Self-reflection config
  const selfReflectionConfig: AgentSelfReflectionConfig = {
    ...DEFAULT_SELF_REFLECTION_CONFIG,
    ...config.selfReflection,
  };

  // Compaction config
  const compactionConfig: AgentCompactionConfig = {
    ...DEFAULT_COMPACTION_CONFIG,
    ...config.compaction,
  };

  // Compaction manager (created when memory is enabled and compaction is enabled)
  let compactionManager: ICompactionManager | null = null;

  // Task completion detector (created lazily when needed)
  let taskCompletionDetector: TaskCompletionDetectorInstance | null = null;

  /**
   * Emit an agent event
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function emitEvent(eventData: { type: AgentEventType } & Record<string, any>): void {
    if (!telemetryConfig.enabled || !eventListener) return;

    const fullEvent = {
      ...eventData,
      timestamp: Date.now(),
      sessionId: memoryManager?.getSessionId() ?? undefined,
    } as AgentEvent;

    try {
      eventListener(fullEvent);
    } catch (error) {
      // Don't let event listener errors break the agent
      if (telemetryConfig.logLevel === 'error' || telemetryConfig.logLevel === 'warn') {
        console.warn('[Agent] Event listener error:', error);
      }
    }
  }

  // Initialize permission policy if configured
  if (permissionConfig?.enabled) {
    permissionPolicy = createPermissionPolicy({
      defaultLevel: permissionConfig.defaultLevel,
      rules: permissionConfig.rules,
      sessionMemory: permissionConfig.sessionMemory,
      categoryDefaults: permissionConfig.categoryDefaults,
    });

    // Set confirmation callback if provided
    if (permissionConfig.onConfirm) {
      permissionPolicy.setConfirmationCallback(permissionConfig.onConfirm);
    }
  }

  // Helper function to check permission and execute tool
  async function executeToolWithPermission(
    tool: Tool,
    args: Record<string, unknown>,
    toolName: string
  ): Promise<{ result: string; executed: boolean; denied?: boolean }> {
    // If no permission policy, execute directly
    if (!permissionPolicy) {
      const result = await tool.execute(args);
      return { result, executed: true };
    }

    // Check permission
    const decision = permissionPolicy.checkPermission(toolName, args);

    // Handle deny
    if (decision.level === 'deny') {
      const denyReason = `Tool "${toolName}" is denied by permission policy`;
      permissionConfig?.onDeny?.(toolName, args, denyReason);
      permissionPolicy.logAudit({
        toolName,
        args,
        decision,
        executed: false,
        error: denyReason,
      });
      return { result: `Error: ${denyReason}`, executed: false, denied: true };
    }

    // Handle confirm
    if (decision.level === 'confirm') {
      const request: ConfirmationRequest = {
        toolName,
        args,
        description: tool.description,
        rule: decision.matchedRule ?? undefined,
        actionDescription: `Execute tool "${toolName}"`,
      };

      const response = await permissionPolicy.requestConfirmation(request);

      if (!response.allowed) {
        const denyReason = response.message || 'User denied tool execution';
        permissionConfig?.onDeny?.(toolName, args, denyReason);
        permissionPolicy.logAudit({
          toolName,
          args,
          decision,
          userResponse: response,
          executed: false,
          error: denyReason,
        });
        return { result: `Error: Tool execution denied - ${denyReason}`, executed: false, denied: true };
      }
    }

    // Execute tool
    try {
      const result = await tool.execute(args);
      permissionConfig?.onExecute?.(toolName, args, result, true);
      permissionPolicy.logAudit({
        toolName,
        args,
        decision,
        executed: true,
        result,
      });
      return { result, executed: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      permissionPolicy.logAudit({
        toolName,
        args,
        decision,
        executed: true,
        error: errorMessage,
      });
      throw error;
    }
  }

  /**
   * Execute multiple async functions with concurrency limit
   */
  async function executeWithConcurrencyLimit<T>(
    tasks: Array<() => Promise<T>>,
    limit: number
  ): Promise<T[]> {
    if (limit === Infinity || tasks.length <= limit) {
      // No limit needed, execute all in parallel
      return Promise.all(tasks.map(task => task()));
    }

    const results: T[] = [];
    const executing = new Set<Promise<void>>();

    for (const task of tasks) {
      const promise = task().then(result => {
        results.push(result);
        executing.delete(promise);
      });
      executing.add(promise);

      if (executing.size >= limit) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
    return results;
  }

  /**
   * Execute a task with timeout
   */
  async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string
  ): Promise<T> {
    let timeoutHandle: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
      clearTimeout(timeoutHandle);
    });
  }

  // Helper function to call chat on either client or provider
  async function doChat(
    messages: ChatCompletionMessageParam[],
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      tools?: ReturnType<typeof defineTool>[];
    }
  ) {
    if (provider) {
      return provider.chat(messages as UnifiedMessage[], {
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        tools: options.tools,
      });
    }
    return client!.chat(messages, options);
  }

  // Helper function to call chatStream on either client or provider
  function doChatStream(
    messages: ChatCompletionMessageParam[],
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      tools?: ReturnType<typeof defineTool>[];
      signal?: AbortSignal;
      onToken?: (token: string) => void;
    }
  ) {
    if (provider) {
      return provider.chatStream(messages as UnifiedMessage[], {
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        tools: options.tools,
        signal: options.signal,
        onToken: options.onToken,
      });
    }
    return client!.chatStream(messages, options);
  }

  // Return the instance object
  const instance: AgentInstance = {
    // ============================================
    // MCP Integration
    // ============================================

    async initializeMCP(): Promise<void> {
      if (!mcpConfig) {
        throw new Error('No MCP configuration provided');
      }

      mcpManager = createMCPClientManager();

      // Build MCP config
      let mcpServerConfig: MCPConfig;
      if (mcpConfig.configPath) {
        // Load from file
        const { loadConfig } = await import('@ai-stack/mcp');
        mcpServerConfig = await loadConfig(mcpConfig.configPath);
      } else if (mcpConfig.servers) {
        // Use inline config
        mcpServerConfig = {
          mcpServers: mcpConfig.servers as MCPConfig['mcpServers'],
        };
      } else {
        throw new Error('MCP config must have either configPath or servers');
      }

      await mcpManager.initialize(mcpServerConfig);
      await mcpManager.connectAll();

      // Create tool provider with default options
      const toolOptions = mcpConfig.toolOptions ?? {
        nameTransformer: (server: string, tool: string) => `mcp__${server}__${tool}`,
      };
      mcpToolProvider = createMCPToolProvider(mcpManager, toolOptions);

      // Register MCP tools
      instance.registerTools(mcpToolProvider.getTools());
    },

    getMCPManager(): MCPClientManagerInstance | null {
      return mcpManager;
    },

    getMCPToolProvider(): MCPToolProviderInstance | null {
      return mcpToolProvider;
    },

    async refreshMCPTools(): Promise<void> {
      if (!mcpToolProvider || !mcpManager) {
        throw new Error('MCP not initialized. Call initializeMCP() first.');
      }

      // Remove old MCP tools
      for (const tool of tools.values()) {
        if (tool.name.startsWith('mcp__')) {
          tools.delete(tool.name);
        }
      }

      // Refresh and re-register
      await mcpToolProvider.refresh();
      instance.registerTools(mcpToolProvider.getTools());
    },

    async closeMCP(): Promise<void> {
      if (mcpManager) {
        await mcpManager.close();
        mcpManager = null;
        mcpToolProvider = null;

        // Remove MCP tools
        for (const tool of tools.values()) {
          if (tool.name.startsWith('mcp__')) {
            tools.delete(tool.name);
          }
        }
      }
    },

    // ============================================
    // Skill Integration
    // ============================================

    async initializeSkills(): Promise<void> {
      if (!skillConfig) {
        throw new Error('No Skill configuration provided');
      }

      skillManager = createSkillManager();

      // Build skill config
      let skillServerConfig: SkillConfig;
      if (skillConfig.configPath) {
        // Load from file
        const { loadConfig } = await import('@ai-stack/skill');
        skillServerConfig = await loadConfig(skillConfig.configPath);
      } else if (skillConfig.skills) {
        // Use inline config
        skillServerConfig = {
          skills: skillConfig.skills,
          autoLoad: skillConfig.autoLoad,
        };
      } else {
        // Empty config - will rely on directory discovery
        skillServerConfig = { skills: {} };
      }

      await skillManager.initialize(skillServerConfig);

      // Load from configured skills
      if (skillServerConfig.autoLoad !== false && Object.keys(skillServerConfig.skills).length > 0) {
        await skillManager.loadAll();
      }

      // Discover and load from directories if specified
      if (skillConfig.directories) {
        for (const dir of skillConfig.directories) {
          await skillManager.discoverAndLoad(dir);
        }
      }

      // Activate all loaded skills
      for (const skillName of skillManager.getSkillNames()) {
        await skillManager.activate(skillName);
      }

      // Create tool provider with default options
      const toolOptions = skillConfig.toolOptions ?? {
        nameTransformer: (skill: string, tool: string) => `skill__${skill}__${tool}`,
      };
      skillToolProvider = createSkillToolProvider(skillManager, toolOptions);

      // Register skill tools
      instance.registerTools(skillToolProvider.getTools());
    },

    getSkillManager(): SkillManagerInstance | null {
      return skillManager;
    },

    getSkillToolProvider(): SkillToolProviderInstance | null {
      return skillToolProvider;
    },

    async refreshSkillTools(): Promise<void> {
      if (!skillToolProvider || !skillManager) {
        throw new Error('Skills not initialized. Call initializeSkills() first.');
      }

      // Remove old skill tools
      for (const tool of tools.values()) {
        if (tool.name.startsWith('skill__')) {
          tools.delete(tool.name);
        }
      }

      // Refresh and re-register
      await skillToolProvider.refresh();
      instance.registerTools(skillToolProvider.getTools());
    },

    async closeSkills(): Promise<void> {
      if (skillManager) {
        await skillManager.close();
        skillManager = null;
        skillToolProvider = null;

        // Remove skill tools
        for (const tool of tools.values()) {
          if (tool.name.startsWith('skill__')) {
            tools.delete(tool.name);
          }
        }
      }
    },

    // ============================================
    // Memory Integration
    // ============================================

    async initializeMemory(): Promise<void> {
      if (!memoryConfig || !memoryConfig.enabled) {
        throw new Error('No Memory configuration provided or memory is disabled');
      }

      // Create SQLite stores with configured path
      const dbPath = memoryConfig.dbPath ?? 'memory/sqlite.db';
      const stores = await createSqliteStores({ dbPath });

      // Build memory manager config
      const memManagerConfig: Partial<MemoryManagerConfig> = {
        debug: memoryConfig.debug ?? false,
      };

      if (memoryConfig.tokenBudget) {
        memManagerConfig.tokenBudget = {
          profile: 200,
          taskState: 300,
          recentEvents: 500,
          semanticChunks: 800,
          summary: 400,
          total: 2200,
          ...memoryConfig.tokenBudget,
        };
      }

      if (memoryConfig.writePolicy) {
        memManagerConfig.writePolicy = {
          minConfidence: 0.5,
          autoSummarize: true,
          summarizeEveryNEvents: 20,
          summarizeTokenThreshold: 4000,
          profileKeyWhitelist: null,
          conflictStrategy: 'latest',
          timeDecayFactor: 0.9,
          staleThresholdMs: 7 * 24 * 60 * 60 * 1000,
          ...memoryConfig.writePolicy,
        };
      }

      if (memoryConfig.retrieval) {
        memManagerConfig.retrieval = {
          maxRecentEvents: 10,
          maxSemanticChunks: 5,
          recentEventsWindowMs: 30 * 60 * 1000,
          enableSemanticSearch: memoryConfig.enableSemanticSearch ?? false,
          enableFtsSearch: true,
          enableRerank: true,
          ...memoryConfig.retrieval,
        };
      }

      memoryManager = createMemoryManager(stores, memManagerConfig);
      await memoryManager.initialize();

      // Initialize compaction manager if enabled
      if (compactionConfig.enabled !== false) {
        const maxTokens = compactionConfig.maxContextTokens ?? 128000;
        const softThreshold = compactionConfig.softThreshold ?? 0.6;
        const hardThreshold = compactionConfig.hardThreshold ?? 0.8;

        compactionManager = createCompactionManager({
          maxContextTokens: maxTokens,
          reserveTokens: compactionConfig.reserveTokens ?? 4000,
          autoCompact: true,
          flush: {
            enabled: true,
            softThresholdTokens: Math.floor(maxTokens * softThreshold),
            hardThresholdTokens: Math.floor(maxTokens * hardThreshold),
            minEventsSinceFlush: 10,
            eventTypesToAnalyze: ['USER_MSG', 'ASSISTANT_MSG', 'DECISION', 'TOOL_RESULT'],
            includeSummary: true,
            flushTags: ['auto-compaction'],
          },
          onCompaction: compactionConfig.onCompaction
            ? (result) => compactionConfig.onCompaction!({
                flushedTokens: result.tokensBefore - result.tokensAfter,
                summary: result.summary?.short ?? '',
                tokensBefore: result.tokensBefore,
                tokensAfter: result.tokensAfter,
              })
            : undefined,
        });
      }
    },

    getMemoryManager(): MemoryManagerInstance | null {
      return memoryManager;
    },

    getCompactionManager(): ICompactionManager | null {
      return compactionManager;
    },

    getSessionId(): string | null {
      return memoryManager?.getSessionId() ?? null;
    },

    newSession(): string | null {
      if (!memoryManager) return null;
      instance.clearHistory();
      return memoryManager.newSession();
    },

    async retrieveMemory(query?: string): Promise<MemoryBundle | null> {
      if (!memoryManager) return null;
      return memoryManager.retrieve({ query });
    },

    async getMemoryContext(query?: string): Promise<string> {
      if (!memoryManager) return '';
      const bundle = await memoryManager.retrieve({ query });
      return memoryManager.inject(bundle);
    },

    async triggerCompaction(): Promise<void> {
      if (!compactionManager || !memoryManager) {
        return;
      }

      const recentEvents = await (async () => {
        const bundle = await memoryManager!.retrieve({});
        return bundle?.recentEvents ?? [];
      })();

      if (recentEvents.length > 0) {
        const result = await compactionManager.compact(recentEvents, {
          sessionId: memoryManager.getSessionId() ?? undefined,
        });

        if (result.success) {
          emitEvent({
            type: 'memory:compaction',
            tokensBefore: result.tokensBefore,
            tokensAfter: result.tokensAfter,
            eventsProcessed: result.eventsProcessed,
            hasSummary: !!result.summary,
          });
        }
      }
    },

    async closeMemory(): Promise<void> {
      if (compactionManager) {
        compactionManager.resetState();
        compactionManager = null;
      }
      if (memoryManager) {
        await memoryManager.close();
        memoryManager = null;
      }
    },

    // ============================================
    // Knowledge Integration
    // ============================================

    async initializeKnowledge(): Promise<void> {
      if (!knowledgeConfig || !knowledgeConfig.enabled) {
        throw new Error('No Knowledge configuration provided or knowledge is disabled');
      }

      // Create knowledge manager with config
      // Knowledge now manages its own database and SemanticStore
      knowledgeManager = createKnowledgeManager({
        dbPath: knowledgeConfig.dbPath ?? 'knowledge/sqlite.db',
        code: knowledgeConfig.code?.enabled !== false
          ? {
              rootDir: knowledgeConfig.code?.rootDir ?? '.',
              include: knowledgeConfig.code?.include,
              exclude: knowledgeConfig.code?.exclude,
              maxFileSize: knowledgeConfig.code?.maxFileSize,
              chunkTokens: knowledgeConfig.code?.chunkTokens,
              overlapTokens: knowledgeConfig.code?.overlapTokens,
              watch: knowledgeConfig.code?.watch,
              watchDebounceMs: knowledgeConfig.code?.watchDebounceMs,
              concurrency: knowledgeConfig.code?.concurrency,
              enabled: true,
            }
          : { enabled: false, rootDir: '.' },
        doc: knowledgeConfig.doc?.enabled !== false
          ? {
              userAgent: knowledgeConfig.doc?.userAgent,
              defaultCrawlOptions: knowledgeConfig.doc?.defaultCrawlOptions,
              chunkTokens: knowledgeConfig.doc?.chunkTokens,
              overlapTokens: knowledgeConfig.doc?.overlapTokens,
              concurrency: knowledgeConfig.doc?.concurrency,
              cacheDir: knowledgeConfig.doc?.cacheDir,
              cacheTtl: knowledgeConfig.doc?.cacheTtl,
              enabled: true,
            }
          : { enabled: false },
        search: {
          defaultWeights: knowledgeConfig.search?.weights ?? { fts: 0.3, vector: 0.7 },
          defaultLimit: knowledgeConfig.search?.maxResults ?? 5,
          temporalDecay: { enabled: true, halfLifeDays: 30 },
          mmr: { enabled: true, lambda: 0.7 },
        },
      });

      // Initialize (creates database, SemanticStore, and indexers)
      await knowledgeManager.initialize();

      // Add pre-configured document sources
      if (knowledgeConfig.doc?.sources) {
        for (const source of knowledgeConfig.doc.sources) {
          await knowledgeManager.addDocSource(source);
        }
      }

      // Start file watching if enabled
      if (knowledgeConfig.code?.watch) {
        knowledgeManager.startWatching();
      }
    },

    getKnowledgeManager(): KnowledgeManagerInstance | null {
      return knowledgeManager;
    },

    async searchKnowledge(
      query: string,
      options?: { sources?: ('code' | 'doc')[]; limit?: number }
    ): Promise<KnowledgeSearchResult[]> {
      if (!knowledgeManager) return [];

      return knowledgeManager.search(query, {
        sources: options?.sources,
        limit: options?.limit ?? knowledgeConfig?.search?.maxResults ?? 5,
        minScore: knowledgeConfig?.search?.minScore ?? 0.3,
      });
    },

    async searchCode(
      query: string,
      options?: { languages?: string[]; limit?: number }
    ): Promise<KnowledgeSearchResult[]> {
      if (!knowledgeManager) return [];

      return knowledgeManager.searchCode(query, {
        languages: options?.languages,
        limit: options?.limit ?? knowledgeConfig?.search?.maxResults ?? 5,
        minScore: knowledgeConfig?.search?.minScore ?? 0.3,
      });
    },

    async searchDocs(
      query: string,
      options?: { sourceIds?: string[]; limit?: number }
    ): Promise<KnowledgeSearchResult[]> {
      if (!knowledgeManager) return [];

      return knowledgeManager.searchDocs(query, {
        sourceIds: options?.sourceIds,
        limit: options?.limit ?? knowledgeConfig?.search?.maxResults ?? 5,
        minScore: knowledgeConfig?.search?.minScore ?? 0.3,
      });
    },

    async getKnowledgeContext(query: string): Promise<string> {
      if (!knowledgeManager) return '';

      const results = await knowledgeManager.search(query, {
        limit: knowledgeConfig?.search?.maxResults ?? 5,
        minScore: knowledgeConfig?.search?.minScore ?? 0.3,
      });

      if (results.length === 0) return '';

      // Format results as context
      const sections: string[] = [];

      // Group by source type
      const codeResults = results.filter((r) => r.sourceType === 'code');
      const docResults = results.filter((r) => r.sourceType === 'doc');

      if (codeResults.length > 0) {
        sections.push('### Relevant Code\n');
        for (const result of codeResults) {
          const meta = result.chunk.code;
          if (meta) {
            sections.push(`**${meta.filePath}:${meta.startLine}-${meta.endLine}** (${meta.language})`);
            if (meta.symbolName) {
              sections.push(`Symbol: \`${meta.symbolName}\` (${meta.symbolType})`);
            }
          }
          sections.push('```');
          sections.push(result.chunk.text.trim());
          sections.push('```\n');
        }
      }

      if (docResults.length > 0) {
        sections.push('### Relevant Documentation\n');
        for (const result of docResults) {
          const meta = result.chunk.doc;
          if (meta) {
            sections.push(`**${meta.title || meta.url}**`);
            if (meta.section) {
              sections.push(`Section: ${meta.section}`);
            }
          }
          sections.push(result.chunk.text.trim());
          sections.push('');
        }
      }

      return sections.join('\n');
    },

    async indexCode(options?: { force?: boolean }): Promise<IndexSummary> {
      if (!knowledgeManager) {
        throw new Error('Knowledge not initialized. Call initializeKnowledge() first.');
      }
      return knowledgeManager.indexCode(options);
    },

    async addDocSource(source: DocSourceInput): Promise<DocSource> {
      if (!knowledgeManager) {
        throw new Error('Knowledge not initialized. Call initializeKnowledge() first.');
      }
      return knowledgeManager.addDocSource(source);
    },

    async removeDocSource(sourceId: string): Promise<void> {
      if (!knowledgeManager) {
        throw new Error('Knowledge not initialized. Call initializeKnowledge() first.');
      }
      return knowledgeManager.removeDocSource(sourceId);
    },

    async crawlDocs(options?: { force?: boolean }): Promise<CrawlSummary> {
      if (!knowledgeManager) {
        throw new Error('Knowledge not initialized. Call initializeKnowledge() first.');
      }
      return knowledgeManager.crawlDocs(options);
    },

    async getKnowledgeStats(): Promise<KnowledgeStats> {
      if (!knowledgeManager) {
        return {
          code: { enabled: false, totalFiles: 0, totalChunks: 0 },
          doc: { enabled: false, totalSources: 0, totalPages: 0, totalChunks: 0 },
        };
      }
      return knowledgeManager.getStats();
    },

    async closeKnowledge(): Promise<void> {
      if (knowledgeManager) {
        await knowledgeManager.close();
        knowledgeManager = null;
      }
    },

    // ============================================
    // Task Management
    // ============================================

    async createTask(
      goal: string,
      options: {
        constraints?: TaskConstraint[];
        plan?: TaskStep[];
      } = {}
    ): Promise<TaskState | null> {
      if (!memoryManager) return null;

      return memoryManager.createTask({
        goal,
        status: 'pending',
        constraints: options.constraints || [],
        plan: options.plan || [],
        done: [],
        blocked: [],
        sessionId: memoryManager.getSessionId(),
      });
    },

    async getCurrentTask(): Promise<TaskState | null> {
      if (!memoryManager) return null;
      return memoryManager.getCurrentTask();
    },

    async updateTask(
      taskId: string,
      update: Partial<TaskState> & { actionId?: string }
    ): Promise<TaskState | null> {
      if (!memoryManager) return null;
      return memoryManager.updateTask(taskId, update);
    },

    async addTaskStep(step: Omit<TaskStep, 'id' | 'status'>): Promise<TaskState | null> {
      const task = await instance.getCurrentTask();
      if (!task) return null;

      const newStep: TaskStep = {
        ...step,
        id: taskReducer.createStepId(),
        status: 'pending',
      };

      const result = taskReducer.reduce(task, TaskActions.addStep(newStep));
      return instance.updateTask(task.id, {
        plan: result.state.plan,
        actionId: `add-step-${newStep.id}`,
      });
    },

    async completeTaskStep(stepId: string, result?: string): Promise<TaskState | null> {
      const task = await instance.getCurrentTask();
      if (!task) return null;

      const reducerResult = taskReducer.reduce(
        task,
        TaskActions.completeStep(stepId, result)
      );

      // Auto-complete task if all steps done
      const updates: Partial<TaskState> & { actionId?: string } = {
        plan: reducerResult.state.plan,
        done: reducerResult.state.done,
        blocked: reducerResult.state.blocked,
        nextAction: reducerResult.state.nextAction,
        actionId: reducerResult.actionId,
      };

      if (taskReducer.isCompleted(reducerResult.state)) {
        updates.status = 'completed';
      }

      return instance.updateTask(task.id, updates);
    },

    async blockTaskStep(stepId: string, reason: string): Promise<TaskState | null> {
      const task = await instance.getCurrentTask();
      if (!task) return null;

      const reducerResult = taskReducer.reduce(
        task,
        TaskActions.blockStep(stepId, reason)
      );

      return instance.updateTask(task.id, {
        plan: reducerResult.state.plan,
        blocked: reducerResult.state.blocked,
        nextAction: reducerResult.state.nextAction,
        actionId: reducerResult.actionId,
      });
    },

    async unblockTaskStep(stepId: string): Promise<TaskState | null> {
      const task = await instance.getCurrentTask();
      if (!task) return null;

      const reducerResult = taskReducer.reduce(
        task,
        TaskActions.unblockStep(stepId)
      );

      return instance.updateTask(task.id, {
        plan: reducerResult.state.plan,
        blocked: reducerResult.state.blocked,
        actionId: `unblock-${stepId}-${Date.now()}`,
      });
    },

    async getTaskProgress(): Promise<{ percentage: number; done: number; total: number } | null> {
      const task = await instance.getCurrentTask();
      if (!task) return null;

      return {
        percentage: taskReducer.getProgress(task),
        done: task.done.length,
        total: task.plan.length,
      };
    },

    async getNextStep(): Promise<TaskStep | null> {
      const task = await instance.getCurrentTask();
      if (!task) return null;
      return taskReducer.getNextStep(task);
    },

    async setTaskStatus(status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'blocked'): Promise<TaskState | null> {
      const task = await instance.getCurrentTask();
      if (!task) return null;

      return instance.updateTask(task.id, {
        status,
        actionId: `set-status-${status}-${Date.now()}`,
      });
    },

    // ============================================
    // Profile Management
    // ============================================

    async setProfile(
      key: string,
      value: unknown,
      options: { confidence?: number; explicit?: boolean; expiresAt?: number } = {}
    ): Promise<unknown | null> {
      if (!memoryManager) return null;

      const item = await memoryManager.setProfile({
        key,
        value,
        confidence: options.confidence ?? 0.8,
        explicit: options.explicit ?? true,
        expiresAt: options.expiresAt,
      });

      return item.value;
    },

    async getProfile(key: string): Promise<unknown | null> {
      if (!memoryManager) return null;
      const item = await memoryManager.getProfile(key);
      return item?.value ?? null;
    },

    async getAllProfiles(): Promise<Record<string, unknown>> {
      if (!memoryManager) return {};
      const items = await memoryManager.getAllProfiles();
      const result: Record<string, unknown> = {};
      for (const item of items) {
        result[item.key] = item.value;
      }
      return result;
    },

    // ============================================
    // Permission Management
    // ============================================

    getPermissionPolicy(): PermissionPolicyInstance | null {
      return permissionPolicy;
    },

    addPermissionRule(rule: PermissionRule): void {
      if (permissionPolicy) {
        permissionPolicy.addRule(rule);
      }
    },

    removePermissionRule(toolPattern: string): boolean {
      if (permissionPolicy) {
        return permissionPolicy.removeRule(toolPattern);
      }
      return false;
    },

    setPermissionCallback(
      callback: ((request: ConfirmationRequest) => Promise<ConfirmationResponse>) | null
    ): void {
      if (permissionPolicy) {
        permissionPolicy.setConfirmationCallback(callback);
      }
    },

    clearSessionApprovals(): void {
      if (permissionPolicy) {
        permissionPolicy.clearSessionApprovals();
      }
    },

    getPermissionAuditLog(): PermissionAuditEntry[] {
      if (permissionPolicy) {
        return permissionPolicy.getAuditLog();
      }
      return [];
    },

    // ============================================
    // State Machine (Orchestrator Layer)
    // ============================================

    getStateMachine(): StateMachineInstance | null {
      return stateMachine;
    },

    getAgentState(): AgentState | null {
      return stateMachine?.getState() ?? null;
    },

    pauseExecution(): void {
      stateMachine?.pause();
    },

    resumeExecution(): void {
      stateMachine?.resume();
    },

    async createCheckpoint(name?: string): Promise<string | null> {
      if (!stateMachine) return null;
      return stateMachine.checkpoint(name);
    },

    async restoreCheckpoint(checkpointId: string): Promise<boolean> {
      if (!stateMachine) return false;
      try {
        await stateMachine.restore(checkpointId);
        return true;
      } catch {
        return false;
      }
    },

    // ============================================
    // Recovery Policy
    // ============================================

    getRecoveryPolicy(): RecoveryPolicyInstance | null {
      return llmRecovery;
    },

    // ============================================
    // Metrics (Observability Layer)
    // ============================================

    getMetricsAggregator(): MetricsAggregatorInstance | null {
      return metricsAggregator;
    },

    getMetrics(): AggregatedMetrics | null {
      return metricsAggregator?.getMetrics() ?? null;
    },

    resetMetrics(): void {
      metricsAggregator?.reset();
    },

    // ============================================
    // Guardrail (Safety Layer)
    // ============================================

    getGuardrail(): GuardrailInstance | null {
      return guardrail;
    },

    addGuardrailRule(rule: GuardrailRule): void {
      guardrail?.addRule(rule);
    },

    removeGuardrailRule(ruleId: string): void {
      guardrail?.removeRule(ruleId);
    },

    // ============================================
    // Model Router
    // ============================================

    getModelRouter(): ModelRouterInstance | null {
      return modelRouter;
    },

    getCostStats(): CostStats | null {
      return modelRouter?.getCostStats() ?? null;
    },

    resetCostStats(): void {
      modelRouter?.resetCostStats();
    },

    // ============================================
    // Evaluator
    // ============================================

    getEvaluator(): EvaluatorInstance | null {
      return evaluator;
    },

    // ============================================
    // Planner
    // ============================================

    getPlanner(): PlannerInstance | null {
      return planner;
    },

    getCurrentPlan(): PlanDAGInstance | null {
      return currentPlan;
    },

    // ============================================
    // Resource Management
    // ============================================

    async close(): Promise<void> {
      // Stop metrics auto-export
      metricsAggregator?.stopAutoExport();

      await Promise.all([
        instance.closeMCP(),
        instance.closeSkills(),
        instance.closeMemory(),
        instance.closeKnowledge(),
      ]);
    },

    // ============================================
    // Configuration
    // ============================================

    getName(): string {
      return agentConfig.name;
    },

    configure(config: Partial<AgentConfig>): void {
      if (config.name !== undefined) agentConfig.name = config.name;
      if (config.systemPrompt !== undefined) agentConfig.systemPrompt = config.systemPrompt;
      if (config.model !== undefined) agentConfig.model = config.model;
      if (config.temperature !== undefined) agentConfig.temperature = config.temperature;
      if (config.maxTokens !== undefined) agentConfig.maxTokens = config.maxTokens;
    },

    // ============================================
    // Tool Management
    // ============================================

    registerTool(tool: Tool): void {
      tools.set(tool.name, tool);
    },

    registerTools(toolsList: Tool[]): void {
      for (const tool of toolsList) {
        instance.registerTool(tool);
      }
    },

    removeTool(name: string): boolean {
      return tools.delete(name);
    },

    getTools(): Tool[] {
      return Array.from(tools.values());
    },

    // ============================================
    // Conversation History
    // ============================================

    clearHistory(): void {
      conversationHistory = [];
    },

    getHistory(): ChatCompletionMessageParam[] {
      return [...conversationHistory];
    },

    addMessage(message: ChatCompletionMessageParam): void {
      conversationHistory.push(message);
    },

    // ============================================
    // Chat Methods
    // ============================================

    async chat(
      input: string,
      options: ConversationOptions = {}
    ): Promise<AgentResponse> {
      const chatStartTime = Date.now();

      // ==========================================================
      // Phase 1: Guardrail Input Check
      // ==========================================================
      if (guardrail) {
        const inputResults = await guardrail.checkInput(input);
        if (guardrail.shouldBlock(inputResults)) {
          const violation = inputResults.find(r => !r.passed);
          const errorMsg = `Input blocked by guardrail: ${violation?.message ?? 'Policy violation'}`;

          // Record metrics
          metricsAggregator?.recordLatency('chat', Date.now() - chatStartTime);
          metricsAggregator?.recordError('chat', 'guardrail_blocked', errorMsg);

          throw new Error(errorMsg);
        }
      }

      // ==========================================================
      // Phase 2: State Machine Transition - START
      // ==========================================================
      stateMachine?.transition({
        type: 'START',
        input,
      });

      // Auto-initialize MCP if configured with autoConnect
      if (mcpConfig?.autoConnect && !mcpManager) {
        await instance.initializeMCP();
      }

      // Auto-initialize Skills if configured with autoLoad
      if (skillConfig?.autoLoad && !skillManager) {
        await instance.initializeSkills();
      }

      // Auto-initialize Memory if configured with autoInitialize
      if (memoryConfig?.enabled && memoryConfig.autoInitialize !== false && !memoryManager) {
        await instance.initializeMemory();
      }

      // Auto-initialize Knowledge if configured with autoInitialize
      if (knowledgeConfig?.enabled && knowledgeConfig.autoInitialize !== false && !knowledgeManager) {
        await instance.initializeKnowledge();
      }

      const { maxIterations = 10, signal } = options;

      // ==========================================================
      // Phase: Initialize Super Loop Components
      // ==========================================================

      // Create StopChecker for intelligent termination
      const useInfiniteLoop = superLoopConfig.infiniteLoop === true;
      const stopChecker: StopCheckerInstance | null = createStopChecker({
        ...config.stopConditions,
        // Override maxIterations if infinite loop is enabled
        maxIterations: useInfiniteLoop ? Infinity : (config.stopConditions?.maxIterations ?? maxIterations),
      });

      // Initialize task completion detector if enabled
      if (superLoopConfig.detectTaskCompletion && !taskCompletionDetector) {
        taskCompletionDetector = createTaskCompletionDetector(
          {
            completionPatterns: superLoopConfig.completionPatterns,
            useLLM: false, // Use pattern-based detection by default
            minConfidence: superLoopConfig.qualityThreshold ?? 0.7,
          },
          // Provide LLM function if evaluator is enabled with LLM
          evaluatorConfig?.useLLMEval
            ? async (prompt: string) => instance.complete(prompt)
            : undefined
        );
      }

      // Token tracking for compaction
      let totalPromptTokens = 0;
      let totalCompletionTokens = 0;
      let lastCompactionCheck = 0;

      // Record user message to memory
      if (memoryManager) {
        const observer = memoryManager.getObserver();
        await memoryManager.recordEvent(
          observer.createUserMessageEvent(input)
        );
      }

      // Add user message to history
      conversationHistory.push(userMessage(input));

      // Build system prompt with memory and knowledge context
      let effectiveSystemPrompt = agentConfig.systemPrompt;
      let injectedSummary: string | undefined; // For compaction summaries

      // Inject memory context
      if (memoryManager && memoryConfig?.autoInject !== false) {
        const memContext = await instance.getMemoryContext(input);
        if (memContext) {
          effectiveSystemPrompt = `${effectiveSystemPrompt}\n\n---\n\n## Memory Context\n\n${memContext}`;
        }
      }

      // Inject knowledge context (auto-search)
      if (knowledgeManager && knowledgeConfig?.search?.autoSearch !== false && knowledgeConfig?.search?.autoInject !== false) {
        const knowledgeContext = await instance.getKnowledgeContext(input);
        if (knowledgeContext) {
          effectiveSystemPrompt = `${effectiveSystemPrompt}\n\n---\n\n## Knowledge Context\n\n${knowledgeContext}`;
        }
      }

      // Build messages with system prompt
      const messages: ChatCompletionMessageParam[] = [
        systemMessage(effectiveSystemPrompt),
        ...conversationHistory,
      ];

      // Build tools array
      const toolsArray = tools.size > 0
        ? Array.from(tools.values()).map((tool) =>
            defineTool(tool.name, tool.description, tool.parameters)
          )
        : undefined;

      const toolCallResults: ToolCallResult[] = [];
      let iterations = 0;
      let selfReflectionRetries = 0;

      while (true) {
        if (signal?.aborted) {
          throw new Error('Request aborted');
        }

        // ==========================================================
        // Super Loop: Stop Condition Check (before iteration)
        // ==========================================================
        if (stopChecker) {
          const executionContext = createExecutionContext({
            iterations,
            toolCalls: toolCallResults,
            promptTokens: totalPromptTokens,
            completionTokens: totalCompletionTokens,
          });

          const stopResult = await stopChecker.check(executionContext);

          if (stopResult.shouldStop) {
            // Emit stop event
            emitEvent({
              type: 'loop:stop',
              reason: stopResult.reason,
              stopType: stopResult.type,
              iterations,
              totalTokens: totalPromptTokens + totalCompletionTokens,
            });

            // Hard stops cannot be overridden
            if (stopResult.type === 'hard') {
              const content = `Task stopped: ${stopResult.reason}`;
              conversationHistory.push(assistantMessage(content));
              return {
                content,
                toolCalls: toolCallResults.length > 0 ? toolCallResults : undefined,
              };
            }

            // Soft stops can be overridden by callback
            if (config.stopConditions?.onStopCondition) {
              const shouldContinue = await config.stopConditions.onStopCondition(stopResult, executionContext);
              if (!shouldContinue) {
                const content = `Task stopped: ${stopResult.reason}`;
                conversationHistory.push(assistantMessage(content));
                return {
                  content,
                  toolCalls: toolCallResults.length > 0 ? toolCallResults : undefined,
                };
              }
            } else if (!useInfiniteLoop) {
              // Legacy behavior: use onMaxIterations callback
              if (stopResult.reason?.includes('Max iterations') && options.onMaxIterations) {
                const shouldContinue = await options.onMaxIterations({
                  currentIterations: iterations,
                  maxIterations,
                  toolCallCount: toolCallResults.length,
                });

                if (!shouldContinue) {
                  const content = 'Task stopped: max iterations reached and user chose not to continue.';
                  conversationHistory.push(assistantMessage(content));
                  return {
                    content,
                    toolCalls: toolCallResults.length > 0 ? toolCallResults : undefined,
                  };
                }
              } else {
                // No callback, throw error (backward compatible)
                throw new Error(stopResult.reason ?? 'Stop condition triggered');
              }
            }
          }
        }

        iterations++;
        const iterationStartTime = Date.now();

        // ==========================================================
        // Super Loop: Checkpoint Creation
        // ==========================================================
        if (
          stateMachine &&
          superLoopConfig.checkpointInterval &&
          iterations % superLoopConfig.checkpointInterval === 0
        ) {
          const checkpointId = await stateMachine.checkpoint(`auto-checkpoint-iter-${iterations}`);
          if (checkpointId) {
            emitEvent({
              type: 'loop:checkpoint',
              checkpointId,
              iteration: iterations,
            });
          }
        }

        // ==========================================================
        // Super Loop: Progress Reporting
        // ==========================================================
        if (superLoopConfig.enableProgressReporting) {
          emitEvent({
            type: 'loop:progress',
            iteration: iterations,
            toolCallCount: toolCallResults.length,
            totalTokens: totalPromptTokens + totalCompletionTokens,
            elapsedMs: Date.now() - chatStartTime,
          });
        }

        // Emit iteration start event
        emitEvent({
          type: 'iteration:start',
          iteration: iterations,
          maxIterations,
        });

        // ==========================================================
        // Phase 4: Model Router - Select Model
        // ==========================================================
        const routingDecision = modelRouter
          ? modelRouter.route(toolsArray ? 'tool_selection' : 'conversation')
          : null;
        const effectiveModel = routingDecision?.model ?? agentConfig.model;

        // Emit LLM request event
        emitEvent({
          type: 'llm:request',
          model: effectiveModel,
          messageCount: messages.length,
          toolCount: toolsArray?.length ?? 0,
        });

        const llmStartTime = Date.now();

        // ==========================================================
        // Phase 3: Recovery Policy - Wrap LLM Call
        // ==========================================================
        let response;
        try {
          const llmCall = () => doChat(messages, {
            model: effectiveModel,
            temperature: agentConfig.temperature,
            maxTokens: agentConfig.maxTokens,
            tools: toolsArray,
          });

          response = llmRecovery
            ? await llmRecovery.execute('llm_chat', llmCall)
            : await llmCall();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          // Record error metrics
          metricsAggregator?.recordLatency('llm_chat', Date.now() - llmStartTime);
          metricsAggregator?.recordError('llm_chat', 'llm_error', errorMessage);

          // State machine error transition
          stateMachine?.transition({
            type: 'ERROR',
            error: error instanceof Error ? error : new Error(errorMessage),
          });

          throw error;
        }

        const llmDurationMs = Date.now() - llmStartTime;

        // ==========================================================
        // Record LLM Metrics + Token Tracking for Compaction
        // ==========================================================
        metricsAggregator?.recordLatency('llm_chat', llmDurationMs);
        if (response.usage) {
          // Update cumulative token counts for stop checker
          totalPromptTokens += response.usage.promptTokens ?? 0;
          totalCompletionTokens += response.usage.completionTokens ?? 0;

          metricsAggregator?.recordTokens(
            effectiveModel,
            response.usage.promptTokens ?? 0,
            response.usage.completionTokens ?? 0
          );
          // Record cost if model router is available
          if (modelRouter && routingDecision) {
            modelRouter.recordUsage(
              routingDecision.tier,
              {
                input: response.usage.promptTokens ?? 0,
                output: response.usage.completionTokens ?? 0,
              }
            );
          }

          // Record consecutive failures for stop checker
          stopChecker?.recordFailure(false); // Successful LLM call

          // ==========================================================
          // Super Loop: Context Compaction Check
          // ==========================================================
          if (compactionManager && iterations > lastCompactionCheck) {
            compactionManager.updateTokenCount(totalPromptTokens + totalCompletionTokens);
            const health = compactionManager.checkHealth();

            if (health.recommendation === 'flush_now' || health.recommendation === 'critical') {
              try {
                // Get recent events for compaction
                const recentEvents = memoryManager
                  ? await (async () => {
                      const bundle = await memoryManager!.retrieve({});
                      return bundle?.recentEvents ?? [];
                    })()
                  : [];

                if (recentEvents.length > 0) {
                  const compactionResult = await compactionManager.compact(recentEvents, {
                    sessionId: memoryManager?.getSessionId() ?? undefined,
                  });

                  if (compactionResult.success) {
                    // Inject summary into next context
                    if (compactionResult.summary?.short) {
                      injectedSummary = compactionResult.summary.short;
                    }

                    // Emit compaction event
                    emitEvent({
                      type: 'memory:compaction',
                      tokensBefore: compactionResult.tokensBefore,
                      tokensAfter: compactionResult.tokensAfter,
                      eventsProcessed: compactionResult.eventsProcessed,
                      hasSummary: !!compactionResult.summary,
                    });
                  }
                }

                lastCompactionCheck = iterations;
              } catch (compactionError) {
                // Log but don't fail on compaction errors
                metricsAggregator?.recordError(
                  'compaction',
                  'compaction_error',
                  compactionError instanceof Error ? compactionError.message : String(compactionError)
                );
              }
            }
          }
        }

        // Emit LLM response event
        emitEvent({
          type: 'llm:response',
          model: effectiveModel,
          hasToolCalls: !!(response.toolCalls && response.toolCalls.length > 0),
          toolCallCount: response.toolCalls?.length ?? 0,
          contentLength: response.content?.length ?? 0,
          usage: response.usage,
          durationMs: llmDurationMs,
        });

        // If no tool calls, we're done (potentially)
        if (!response.toolCalls || response.toolCalls.length === 0) {
          let content = response.content ?? '';

          // ==========================================================
          // Phase 2: Guardrail Output Check
          // ==========================================================
          if (guardrail) {
            const outputResults = await guardrail.checkOutput(content);
            if (guardrail.shouldBlock(outputResults)) {
              const violation = outputResults.find(r => !r.passed);
              // Filter/modify output instead of blocking entirely
              content = `[Content filtered: ${violation?.message ?? 'Policy violation'}]`;
              metricsAggregator?.recordError('chat', 'guardrail_output_filtered', violation?.message);
            }
          }

          // ==========================================================
          // Super Loop: Self-Reflection Evaluation
          // ==========================================================
          if (selfReflectionConfig.enabled && evaluator) {
            emitEvent({
              type: 'evaluation:start',
              iteration: iterations,
              retryCount: selfReflectionRetries,
            });

            const evalContext: EvalContext = {
              originalRequest: input,
              toolResults: toolCallResults.map((tc) => ({
                name: tc.name,
                args: tc.args,
                result: tc.result,
                success: !tc.result.toLowerCase().includes('error'),
              })),
              retryCount: selfReflectionRetries,
              maxRetries: selfReflectionConfig.maxRetries ?? 1,
            };

            const evalResult = await evaluator.evaluate(content, evalContext);

            emitEvent({
              type: 'evaluation:complete',
              score: evalResult.score,
              passed: evalResult.passed,
              issues: evalResult.issues,
            });

            // Check if we should retry
            if (!evalResult.passed && selfReflectionRetries < (selfReflectionConfig.maxRetries ?? 1)) {
              selfReflectionRetries++;

              emitEvent({
                type: 'evaluation:retry',
                retryCount: selfReflectionRetries,
                reason: evalResult.retryReason,
                suggestions: evalResult.suggestions,
              });

              // Add feedback to prompt for retry
              if (selfReflectionConfig.includeFeedback !== false) {
                const feedback = `The previous response scored ${evalResult.score.toFixed(2)} which is below the quality threshold. ` +
                  `Issues identified: ${evalResult.issues.join(', ')}. ` +
                  `Suggestions: ${evalResult.suggestions.join(', ')}. ` +
                  `Please provide an improved response.`;
                messages.push(userMessage(feedback));
              }

              // Continue the loop for retry
              continue;
            }

            // Consistency self-check
            if (selfReflectionConfig.enableSelfCheck && evalResult.passed) {
              const selfCheckResult = await evaluator.selfCheck(content, evalContext);
              if (!selfCheckResult.consistent) {
                emitEvent({
                  type: 'evaluation:inconsistency',
                  problems: selfCheckResult.problems,
                  corrections: selfCheckResult.corrections,
                });
              }
            }
          }

          // ==========================================================
          // Super Loop: Task Completion Detection
          // ==========================================================
          if (useInfiniteLoop && taskCompletionDetector) {
            const completionResult = await taskCompletionDetector.detect(content, {
              originalRequest: input,
              toolCalls: toolCallResults,
              iterations,
            });

            // If task is not complete and we haven't hit stop conditions, continue
            if (!completionResult.isComplete && completionResult.confidence < 0.7) {
              // Add a hint to the model to continue
              const continuePrompt = `The task may not be complete yet (confidence: ${completionResult.confidence.toFixed(2)}). ` +
                `Reason: ${completionResult.reason}. ` +
                (completionResult.suggestions?.length
                  ? `Consider: ${completionResult.suggestions.join(', ')}`
                  : 'Please continue with the task.');

              messages.push(userMessage(continuePrompt));
              continue;
            }
          }

          conversationHistory.push(assistantMessage(content));

          // Record assistant message to memory
          if (memoryManager) {
            const observer = memoryManager.getObserver();
            await memoryManager.recordEvent(
              observer.createAssistantMessageEvent(content, {
                hasToolCalls: toolCallResults.length > 0,
              })
            );
          }

          // ==========================================================
          // State Machine - COMPLETE
          // ==========================================================
          stateMachine?.transition({
            type: 'COMPLETE',
            result: content,
          });

          // ==========================================================
          // Record Final Metrics
          // ==========================================================
          metricsAggregator?.recordLatency('chat', Date.now() - chatStartTime);

          return {
            content,
            toolCalls: toolCallResults.length > 0 ? toolCallResults : undefined,
            usage: response.usage,
          };
        }

        // Add assistant message with tool calls to history
        messages.push({
          role: 'assistant',
          content: response.content,
          tool_calls: response.toolCalls,
        });

        // Execute tool calls (parallel if enabled)
        const toolTasks = response.toolCalls.map((toolCall) => async () => {
          const tool = tools.get(toolCall.function.name);
          const toolStartTime = Date.now();

          if (!tool) {
            const errorResult = `Error: Unknown tool "${toolCall.function.name}"`;
            emitEvent({
              type: 'tool:error',
              toolName: toolCall.function.name,
              error: errorResult,
              toolCallId: toolCall.id,
              durationMs: Date.now() - toolStartTime,
            });
            return { toolCall, result: errorResult, args: {}, error: true };
          }

          try {
            const args = JSON.parse(toolCall.function.arguments);

            // ==========================================================
            // Guardrail Tool Call Check
            // ==========================================================
            if (guardrail) {
              const toolCheckResults = await guardrail.checkToolCall(toolCall.function.name, args);
              if (guardrail.shouldBlock(toolCheckResults)) {
                const violation = toolCheckResults.find(r => !r.passed);
                const blockResult = `Tool call blocked by guardrail: ${violation?.message ?? 'Policy violation'}`;
                metricsAggregator?.recordToolCall(toolCall.function.name, Date.now() - toolStartTime, false, blockResult);
                return { toolCall, result: blockResult, args, error: true };
              }
            }

            // Emit tool start event
            emitEvent({
              type: 'tool:start',
              toolName: toolCall.function.name,
              args,
              toolCallId: toolCall.id,
            });

            // Record tool call to memory
            let toolCallEventId: string | undefined;
            if (memoryManager) {
              const observer = memoryManager.getObserver();
              const event = await memoryManager.recordEvent(
                observer.createToolCallEvent(toolCall.function.name, args)
              );
              toolCallEventId = event.id;
            }

            // ==========================================================
            // Execute with Recovery Policy, Permission Check, and Timeout
            // ==========================================================
            const toolExecutor = async () => {
              const executePromise = executeToolWithPermission(
                tool,
                args,
                toolCall.function.name
              );

              return toolExecConfig.toolTimeout > 0
                ? await withTimeout(
                    executePromise,
                    toolExecConfig.toolTimeout,
                    `Tool "${toolCall.function.name}" timed out after ${toolExecConfig.toolTimeout}ms`
                  )
                : await executePromise;
            };

            const { result } = toolRecovery
              ? await toolRecovery.execute(`tool_${toolCall.function.name}`, toolExecutor)
              : await toolExecutor();

            const toolDurationMs = Date.now() - toolStartTime;

            // Record tool result to memory
            if (memoryManager) {
              const observer = memoryManager.getObserver();
              await memoryManager.recordEvent(
                observer.createToolResultEvent(toolCall.function.name, result, toolCallEventId)
              );
            }

            // ==========================================================
            // Record Tool Metrics
            // ==========================================================
            metricsAggregator?.recordToolCall(toolCall.function.name, toolDurationMs, true);

            // Emit tool end event
            emitEvent({
              type: 'tool:end',
              toolName: toolCall.function.name,
              result,
              toolCallId: toolCall.id,
              durationMs: toolDurationMs,
            });

            return { toolCall, result, args, error: false };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorResult = `Error executing tool: ${errorMessage}`;
            const toolDurationMs = Date.now() - toolStartTime;

            // Record tool error metrics
            metricsAggregator?.recordToolCall(toolCall.function.name, toolDurationMs, false, errorMessage);

            // Emit tool error event
            emitEvent({
              type: 'tool:error',
              toolName: toolCall.function.name,
              error: errorResult,
              toolCallId: toolCall.id,
              durationMs: Date.now() - toolStartTime,
            });

            return { toolCall, result: errorResult, args: {}, error: true };
          }
        });

        // Execute tools with concurrency limit (parallel or serial based on config)
        const toolResults = toolExecConfig.parallelExecution
          ? await executeWithConcurrencyLimit(toolTasks, toolExecConfig.maxConcurrentTools)
          : await Promise.all(toolTasks.map(task => task())); // Serial execution

        // Process results in order
        for (const { toolCall, result, args, error } of toolResults) {
          if (!error) {
            toolCallResults.push({
              name: toolCall.function.name,
              args,
              result,
            });
          } else {
            toolCallResults.push({
              name: toolCall.function.name,
              args: {},
              result,
            });
          }
          messages.push(toolMessage(toolCall.id, result));
        }

        // Emit iteration end event
        emitEvent({
          type: 'iteration:end',
          iteration: iterations,
          toolCallCount: toolResults.length,
          durationMs: Date.now() - iterationStartTime,
        });
      }
      // Note: Loop exits via return statements or throw inside
    },

    async stream(
      input: string,
      callbacks: StreamCallbacks = {},
      options: ConversationOptions = {}
    ): Promise<AgentResponse> {
      const streamStartTime = Date.now();

      // ==========================================================
      // Guardrail Input Check (same as chat)
      // ==========================================================
      if (guardrail) {
        const inputResults = await guardrail.checkInput(input);
        if (guardrail.shouldBlock(inputResults)) {
          const violation = inputResults.find(r => !r.passed);
          const errorMsg = `Input blocked by guardrail: ${violation?.message ?? 'Policy violation'}`;
          metricsAggregator?.recordLatency('stream', Date.now() - streamStartTime);
          metricsAggregator?.recordError('stream', 'guardrail_blocked', errorMsg);
          throw new Error(errorMsg);
        }
      }

      // ==========================================================
      // State Machine Transition - START
      // ==========================================================
      stateMachine?.transition({
        type: 'START',
        input,
      });

      // Auto-initialize MCP if configured with autoConnect
      if (mcpConfig?.autoConnect && !mcpManager) {
        await instance.initializeMCP();
      }

      const { maxIterations = 10, signal } = options;
      const { onToken, onToolCall, onToolResult, onComplete, onError } = callbacks;

      // Auto-initialize Skills if configured with autoLoad
      if (skillConfig?.autoLoad && !skillManager) {
        await instance.initializeSkills();
      }

      // Auto-initialize Memory if configured with autoInitialize
      if (memoryConfig?.enabled && memoryConfig.autoInitialize !== false && !memoryManager) {
        await instance.initializeMemory();
      }

      // Auto-initialize Knowledge if configured with autoInitialize
      if (knowledgeConfig?.enabled && knowledgeConfig.autoInitialize !== false && !knowledgeManager) {
        await instance.initializeKnowledge();
      }

      try {
        // Record user message to memory
        if (memoryManager) {
          const observer = memoryManager.getObserver();
          await memoryManager.recordEvent(
            observer.createUserMessageEvent(input)
          );
        }

        // Add user message to history
        conversationHistory.push(userMessage(input));

        // Build system prompt with memory and knowledge context
        let effectiveSystemPrompt = agentConfig.systemPrompt;

        // Inject memory context
        if (memoryManager && memoryConfig?.autoInject !== false) {
          const memContext = await instance.getMemoryContext(input);
          if (memContext) {
            effectiveSystemPrompt = `${effectiveSystemPrompt}\n\n---\n\n## Memory Context\n\n${memContext}`;
          }
        }

        // Inject knowledge context (auto-search)
        if (knowledgeManager && knowledgeConfig?.search?.autoSearch !== false && knowledgeConfig?.search?.autoInject !== false) {
          const knowledgeContext = await instance.getKnowledgeContext(input);
          if (knowledgeContext) {
            effectiveSystemPrompt = `${effectiveSystemPrompt}\n\n---\n\n## Knowledge Context\n\n${knowledgeContext}`;
          }
        }

        // Build messages with system prompt
        const messages: ChatCompletionMessageParam[] = [
          systemMessage(effectiveSystemPrompt),
          ...conversationHistory,
        ];

        // Build tools array
        const toolsArray = tools.size > 0
          ? Array.from(tools.values()).map((tool) =>
              defineTool(tool.name, tool.description, tool.parameters)
            )
          : undefined;

        const toolCallResults: ToolCallResult[] = [];
        let iterations = 0;
        let fullContent = '';

        while (true) {
          if (signal?.aborted) {
            throw new Error('Request aborted');
          }

          // Check if max iterations reached
          if (iterations >= maxIterations) {
            if (options.onMaxIterations) {
              const shouldContinue = await options.onMaxIterations({
                currentIterations: iterations,
                maxIterations,
                toolCallCount: toolCallResults.length,
              });

              if (shouldContinue) {
                // Reset counter, user gets another maxIterations rounds
                iterations = 0;
              } else {
                // User chose to stop, return gracefully instead of throwing
                const content = 'Task stopped: max iterations reached and user chose not to continue.';
                conversationHistory.push(assistantMessage(content));

                const response: AgentResponse = {
                  content,
                  toolCalls: toolCallResults.length > 0 ? toolCallResults : undefined,
                };

                onComplete?.(response);
                return response;
              }
            } else {
              // No callback provided, throw error (backward compatible)
              throw new Error(`Max iterations (${maxIterations}) reached`);
            }
          }

          iterations++;

          const stream = doChatStream(messages, {
            model: agentConfig.model,
            temperature: agentConfig.temperature,
            maxTokens: agentConfig.maxTokens,
            tools: toolsArray,
            signal,
            onToken,
          });

          let iterationContent = '';

          // Consume the stream and get the final result
          let iteratorResult = await stream.next();
          while (!iteratorResult.done) {
            const token = iteratorResult.value;
            iterationContent += token;
            fullContent += token;
            iteratorResult = await stream.next();
          }

          // When done is true, value is the return value (ChatCompletionResult)
          const finalResult = iteratorResult.value;

          // If no tool calls, we're done
          if (!finalResult.toolCalls || finalResult.toolCalls.length === 0) {
            let outputContent = fullContent;

            // ==========================================================
            // Guardrail Output Check (same as chat)
            // ==========================================================
            if (guardrail) {
              const outputResults = await guardrail.checkOutput(outputContent);
              if (guardrail.shouldBlock(outputResults)) {
                const violation = outputResults.find(r => !r.passed);
                outputContent = `[Content filtered: ${violation?.message ?? 'Policy violation'}]`;
                metricsAggregator?.recordError('stream', 'guardrail_output_filtered', violation?.message);
              }
            }

            conversationHistory.push(assistantMessage(outputContent));

            // Record assistant message to memory
            if (memoryManager) {
              const observer = memoryManager.getObserver();
              await memoryManager.recordEvent(
                observer.createAssistantMessageEvent(outputContent, {
                  hasToolCalls: toolCallResults.length > 0,
                })
              );
            }

            // ==========================================================
            // State Machine - COMPLETE
            // ==========================================================
            stateMachine?.transition({
              type: 'COMPLETE',
              result: outputContent,
            });

            // ==========================================================
            // Record Final Metrics
            // ==========================================================
            metricsAggregator?.recordLatency('stream', Date.now() - streamStartTime);

            const response: AgentResponse = {
              content: outputContent,
              toolCalls: toolCallResults.length > 0 ? toolCallResults : undefined,
            };

            onComplete?.(response);
            return response;
          }

          // Add assistant message with tool calls to history
          messages.push({
            role: 'assistant',
            content: iterationContent || null,
            tool_calls: finalResult.toolCalls,
          });

          // Execute tool calls (parallel if enabled)
          const toolTasks = finalResult.toolCalls.map((toolCall) => async () => {
            const tool = tools.get(toolCall.function.name);

            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(toolCall.function.arguments);
            } catch {
              // Ignore parse errors
            }

            onToolCall?.(toolCall.function.name, args);

            // Record tool call to memory
            let toolCallEventId: string | undefined;
            if (memoryManager) {
              const observer = memoryManager.getObserver();
              const event = await memoryManager.recordEvent(
                observer.createToolCallEvent(toolCall.function.name, args)
              );
              toolCallEventId = event.id;
            }

            const toolStartTime = Date.now();

            if (!tool) {
              const errorResult = `Error: Unknown tool "${toolCall.function.name}"`;
              onToolResult?.(toolCall.function.name, errorResult);
              metricsAggregator?.recordToolCall(toolCall.function.name, Date.now() - toolStartTime, false, errorResult);
              return { toolCall, result: errorResult, args, error: true };
            }

            // ==========================================================
            // Guardrail Tool Call Check
            // ==========================================================
            if (guardrail) {
              const toolCheckResults = await guardrail.checkToolCall(toolCall.function.name, args);
              if (guardrail.shouldBlock(toolCheckResults)) {
                const violation = toolCheckResults.find(r => !r.passed);
                const blockResult = `Tool call blocked by guardrail: ${violation?.message ?? 'Policy violation'}`;
                onToolResult?.(toolCall.function.name, blockResult);
                metricsAggregator?.recordToolCall(toolCall.function.name, Date.now() - toolStartTime, false, blockResult);
                return { toolCall, result: blockResult, args, error: true };
              }
            }

            try {
              // Execute with recovery policy, permission check and timeout
              const toolExecutor = async () => {
                const executePromise = executeToolWithPermission(
                  tool,
                  args,
                  toolCall.function.name
                );

                return toolExecConfig.toolTimeout > 0
                  ? await withTimeout(
                      executePromise,
                      toolExecConfig.toolTimeout,
                      `Tool "${toolCall.function.name}" timed out after ${toolExecConfig.toolTimeout}ms`
                    )
                  : await executePromise;
              };

              const { result } = toolRecovery
                ? await toolRecovery.execute(`tool_${toolCall.function.name}`, toolExecutor)
                : await toolExecutor();

              const toolDurationMs = Date.now() - toolStartTime;

              // Record tool result to memory
              if (memoryManager) {
                const observer = memoryManager.getObserver();
                await memoryManager.recordEvent(
                  observer.createToolResultEvent(toolCall.function.name, result, toolCallEventId)
                );
              }

              // Record tool metrics
              metricsAggregator?.recordToolCall(toolCall.function.name, toolDurationMs, true);

              onToolResult?.(toolCall.function.name, result);
              return { toolCall, result, args, error: false };
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              const errorResult = `Error executing tool: ${errorMessage}`;
              const toolDurationMs = Date.now() - toolStartTime;

              // Record tool error metrics
              metricsAggregator?.recordToolCall(toolCall.function.name, toolDurationMs, false, errorMessage);

              onToolResult?.(toolCall.function.name, errorResult);
              return { toolCall, result: errorResult, args, error: true };
            }
          });

          // Execute tools with concurrency limit
          const toolResults = toolExecConfig.parallelExecution
            ? await executeWithConcurrencyLimit(toolTasks, toolExecConfig.maxConcurrentTools)
            : await Promise.all(toolTasks.map(task => task()));

          // Process results in order
          for (const { toolCall, result, args, error } of toolResults) {
            if (!error) {
              toolCallResults.push({
                name: toolCall.function.name,
                args,
                result,
              });
            } else {
              toolCallResults.push({
                name: toolCall.function.name,
                args,
                result,
              });
            }
            messages.push(toolMessage(toolCall.id, result));
          }
        }
        // Note: Loop exits via return statements or throw inside
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        // ==========================================================
        // State Machine - ERROR
        // ==========================================================
        stateMachine?.transition({
          type: 'ERROR',
          error: err,
        });

        // Record error metrics
        metricsAggregator?.recordLatency('stream', Date.now() - streamStartTime);
        metricsAggregator?.recordError('stream', 'stream_error', err.message);

        onError?.(err);
        throw err;
      }
    },

    async complete(
      prompt: string,
      systemPromptOverride?: string
    ): Promise<string> {
      const response = await doChat(
        [
          systemMessage(systemPromptOverride ?? agentConfig.systemPrompt),
          userMessage(prompt),
        ],
        {
          model: agentConfig.model,
          temperature: agentConfig.temperature,
          maxTokens: agentConfig.maxTokens,
        }
      );

      return response.content ?? '';
    },

    // ============================================
    // Telemetry
    // ============================================

    setEventListener(listener: AgentEventListener | null): void {
      eventListener = listener ?? undefined;
    },
  };

  // Register AskUser tool if callback is provided
  if (config.onAskUser) {
    instance.registerTool(createAskUserTool(config.onAskUser));
  }

  // ==========================================================================
  // Deferred Initialization: Evaluator and Planner (need chat function)
  // ==========================================================================

  // Initialize Evaluator (uses instance.complete for LLM evaluation)
  if (evaluatorConfig?.enabled) {
    evaluator = createEvaluator(
      {
        passThreshold: evaluatorConfig.passThreshold ?? 0.7,
        useLLMEval: evaluatorConfig.useLLMEval ?? false,
        evalModel: evaluatorConfig.evalModel,
        maxRetries: evaluatorConfig.maxRetries ?? 1,
        enableSelfCheck: evaluatorConfig.enableSelfCheck ?? false,
      },
      // LLM function for evaluation
      async (prompt: string) => instance.complete(prompt)
    );
  }

  // Initialize Planner (uses instance.complete for plan generation)
  if (plannerConfig?.enabled) {
    planner = createPlanner(
      {
        mode: plannerConfig.mode ?? 'react',
        maxSteps: plannerConfig.maxSteps ?? 10,
        allowDynamicReplanning: plannerConfig.allowDynamicReplanning ?? true,
      },
      // LLM function for planning
      async (prompt: string) => instance.complete(prompt)
    );
  }

  return instance;
}

