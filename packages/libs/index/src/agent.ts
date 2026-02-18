/**
 * Agent - Main AI Agent implementation
 */

import {
  createOpenAIClient,
  systemMessage,
  userMessage,
  assistantMessage,
  toolMessage,
  defineTool,
  type ChatCompletionMessageParam,
  type OpenAIClientInstance,
} from '@agent-stack/provider';
import {
  createMCPClientManager,
  createMCPToolProvider,
  type MCPConfig,
  type MCPClientManagerInstance,
  type MCPToolProviderInstance,
} from '@agent-stack/mcp';
import {
  createSkillManager,
  createSkillToolProvider,
  type SkillConfig,
  type SkillManagerInstance,
  type SkillToolProviderInstance,
} from '@agent-stack/skill';
import {
  createMemoryManager,
  TaskStateReducer,
  TaskActions,
  type MemoryManagerConfig,
  type MemoryBundle,
  type TaskState,
  type TaskStep,
  type TaskConstraint,
  type MemoryManagerInstance,
  type IMemoryObserver,
  type IMemoryBudgeter,
  type MemoryStores,
} from '@agent-stack/memory';
import {
  createSqliteStores,
} from '@agent-stack/memory-store-sqlite';
import type {
  AgentConfig,
  AgentMCPConfig,
  AgentSkillConfig,
  AgentMemoryConfig,
  Tool,
  AgentResponse,
  ToolCallResult,
  StreamCallbacks,
  ConversationOptions,
} from './types';

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
  getSessionId(): string | null;
  newSession(): string | null;
  retrieveMemory(query?: string): Promise<MemoryBundle | null>;
  getMemoryContext(query?: string): Promise<string>;
  closeMemory(): Promise<void>;

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
}

/**
 * Create an Agent instance
 */
export function createAgent(config: AgentConfig = {}): AgentInstance {
  // Private state via closure
  const client: OpenAIClientInstance = createOpenAIClient({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

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
        const { loadConfig } = await import('@agent-stack/mcp');
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
        const { loadConfig } = await import('@agent-stack/skill');
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
      const dbPath = memoryConfig.dbPath ?? '.agent-stack/memory.db';
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
    },

    getMemoryManager(): MemoryManagerInstance | null {
      return memoryManager;
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

    async closeMemory(): Promise<void> {
      if (memoryManager) {
        await memoryManager.close();
        memoryManager = null;
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
    // Resource Management
    // ============================================

    async close(): Promise<void> {
      await Promise.all([
        instance.closeMCP(),
        instance.closeSkills(),
        instance.closeMemory(),
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

      const { maxIterations = 10, signal } = options;

      // Record user message to memory
      if (memoryManager) {
        const observer = memoryManager.getObserver();
        await memoryManager.recordEvent(
          observer.createUserMessageEvent(input)
        );
      }

      // Add user message to history
      conversationHistory.push(userMessage(input));

      // Build system prompt with memory context
      let effectiveSystemPrompt = agentConfig.systemPrompt;
      if (memoryManager && memoryConfig?.autoInject !== false) {
        const memContext = await instance.getMemoryContext(input);
        if (memContext) {
          effectiveSystemPrompt = `${agentConfig.systemPrompt}\n\n---\n\n## Memory Context\n\n${memContext}`;
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

      while (iterations < maxIterations) {
        if (signal?.aborted) {
          throw new Error('Request aborted');
        }

        iterations++;

        const response = await client.chat(messages, {
          model: agentConfig.model,
          temperature: agentConfig.temperature,
          maxTokens: agentConfig.maxTokens,
          tools: toolsArray,
        });

        // If no tool calls, we're done
        if (!response.toolCalls || response.toolCalls.length === 0) {
          const content = response.content ?? '';
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

        // Execute tool calls
        for (const toolCall of response.toolCalls) {
          const tool = tools.get(toolCall.function.name);
          if (!tool) {
            const errorResult = `Error: Unknown tool "${toolCall.function.name}"`;
            messages.push(toolMessage(toolCall.id, errorResult));
            continue;
          }

          try {
            const args = JSON.parse(toolCall.function.arguments);

            // Record tool call to memory
            let toolCallEventId: string | undefined;
            if (memoryManager) {
              const observer = memoryManager.getObserver();
              const event = await memoryManager.recordEvent(
                observer.createToolCallEvent(toolCall.function.name, args)
              );
              toolCallEventId = event.id;
            }

            const result = await tool.execute(args);

            // Record tool result to memory
            if (memoryManager) {
              const observer = memoryManager.getObserver();
              await memoryManager.recordEvent(
                observer.createToolResultEvent(toolCall.function.name, result, toolCallEventId)
              );
            }

            toolCallResults.push({
              name: toolCall.function.name,
              args,
              result,
            });

            messages.push(toolMessage(toolCall.id, result));
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorResult = `Error executing tool: ${errorMessage}`;
            messages.push(toolMessage(toolCall.id, errorResult));

            toolCallResults.push({
              name: toolCall.function.name,
              args: {},
              result: errorResult,
            });
          }
        }
      }

      throw new Error(`Max iterations (${maxIterations}) reached`);
    },

    async stream(
      input: string,
      callbacks: StreamCallbacks = {},
      options: ConversationOptions = {}
    ): Promise<AgentResponse> {
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

        // Build system prompt with memory context
        let effectiveSystemPrompt = agentConfig.systemPrompt;
        if (memoryManager && memoryConfig?.autoInject !== false) {
          const memContext = await instance.getMemoryContext(input);
          if (memContext) {
            effectiveSystemPrompt = `${agentConfig.systemPrompt}\n\n---\n\n## Memory Context\n\n${memContext}`;
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

        while (iterations < maxIterations) {
          if (signal?.aborted) {
            throw new Error('Request aborted');
          }

          iterations++;

          const stream = client.chatStream(messages, {
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
            conversationHistory.push(assistantMessage(fullContent));

            // Record assistant message to memory
            if (memoryManager) {
              const observer = memoryManager.getObserver();
              await memoryManager.recordEvent(
                observer.createAssistantMessageEvent(fullContent, {
                  hasToolCalls: toolCallResults.length > 0,
                })
              );
            }

            const response: AgentResponse = {
              content: fullContent,
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

          // Execute tool calls
          for (const toolCall of finalResult.toolCalls) {
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

            if (!tool) {
              const errorResult = `Error: Unknown tool "${toolCall.function.name}"`;
              messages.push(toolMessage(toolCall.id, errorResult));
              onToolResult?.(toolCall.function.name, errorResult);
              continue;
            }

            try {
              const result = await tool.execute(args);

              // Record tool result to memory
              if (memoryManager) {
                const observer = memoryManager.getObserver();
                await memoryManager.recordEvent(
                  observer.createToolResultEvent(toolCall.function.name, result, toolCallEventId)
                );
              }

              toolCallResults.push({
                name: toolCall.function.name,
                args,
                result,
              });

              messages.push(toolMessage(toolCall.id, result));
              onToolResult?.(toolCall.function.name, result);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              const errorResult = `Error executing tool: ${errorMessage}`;
              messages.push(toolMessage(toolCall.id, errorResult));
              onToolResult?.(toolCall.function.name, errorResult);

              toolCallResults.push({
                name: toolCall.function.name,
                args,
                result: errorResult,
              });
            }
          }
        }

        throw new Error(`Max iterations (${maxIterations}) reached`);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        onError?.(err);
        throw err;
      }
    },

    async complete(
      prompt: string,
      systemPromptOverride?: string
    ): Promise<string> {
      const response = await client.chat(
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
  };

  return instance;
}

