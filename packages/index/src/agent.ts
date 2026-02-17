/**
 * Agent - Main AI Agent implementation
 */

import {
  OpenAIClient,
  systemMessage,
  userMessage,
  assistantMessage,
  toolMessage,
  defineTool,
  type ChatCompletionMessageParam,
} from '@agent-stack/provider';
import {
  MCPClientManager,
  MCPToolProvider,
  type MCPConfig,
} from '@agent-stack/mcp';
import {
  SkillManager,
  SkillToolProvider,
  type SkillConfig,
} from '@agent-stack/skill';
import {
  MemoryManager,
  TaskStateReducer,
  TaskActions,
  type MemoryConfig,
  type MemoryBundle,
  type TaskState,
  type TaskStep,
  type TaskConstraint,
} from '@agent-stack/memory';
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

export class Agent {
  private client: OpenAIClient;
  private config: Required<Pick<AgentConfig, 'name' | 'systemPrompt' | 'model' | 'temperature' | 'maxTokens'>>;
  private tools: Map<string, Tool> = new Map();
  private conversationHistory: ChatCompletionMessageParam[] = [];

  // MCP integration
  private mcpManager: MCPClientManager | null = null;
  private mcpToolProvider: MCPToolProvider | null = null;
  private mcpConfig: AgentMCPConfig | null = null;

  // Skill integration
  private skillManager: SkillManager | null = null;
  private skillToolProvider: SkillToolProvider | null = null;
  private skillConfig: AgentSkillConfig | null = null;

  // Memory integration
  private memoryManager: MemoryManager | null = null;
  private memoryConfig: AgentMemoryConfig | null = null;
  private taskReducer: TaskStateReducer = new TaskStateReducer();

  constructor(config: AgentConfig = {}) {
    this.client = new OpenAIClient({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });

    this.config = {
      name: config.name ?? 'Agent',
      systemPrompt: config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      model: config.model ?? 'gpt-4o',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 4096,
    };

    // Store MCP config for later initialization
    if (config.mcp) {
      this.mcpConfig = config.mcp;
    }

    // Store Skill config for later initialization
    if (config.skill) {
      this.skillConfig = config.skill;
    }

    // Store Memory config for later initialization
    if (config.memory) {
      this.memoryConfig = config.memory === true
        ? { enabled: true }
        : { enabled: true, ...config.memory };
    }
  }

  /**
   * Initialize MCP connections
   * Call this before using MCP tools, or set autoConnect: true in config
   */
  async initializeMCP(): Promise<void> {
    if (!this.mcpConfig) {
      throw new Error('No MCP configuration provided');
    }

    this.mcpManager = new MCPClientManager();

    // Build MCP config
    let mcpConfig: MCPConfig;
    if (this.mcpConfig.configPath) {
      // Load from file
      const { loadConfig } = await import('@agent-stack/mcp');
      mcpConfig = await loadConfig(this.mcpConfig.configPath);
    } else if (this.mcpConfig.servers) {
      // Use inline config
      mcpConfig = {
        mcpServers: this.mcpConfig.servers as MCPConfig['mcpServers'],
      };
    } else {
      throw new Error('MCP config must have either configPath or servers');
    }

    await this.mcpManager.initialize(mcpConfig);
    await this.mcpManager.connectAll();

    // Create tool provider with default options
    const toolOptions = this.mcpConfig.toolOptions ?? {
      nameTransformer: (server, tool) => `mcp__${server}__${tool}`,
    };
    this.mcpToolProvider = new MCPToolProvider(this.mcpManager, toolOptions);

    // Register MCP tools
    this.registerTools(this.mcpToolProvider.getTools());
  }

  /**
   * Get the MCP client manager (for advanced usage)
   */
  getMCPManager(): MCPClientManager | null {
    return this.mcpManager;
  }

  /**
   * Get the MCP tool provider (for advanced usage)
   */
  getMCPToolProvider(): MCPToolProvider | null {
    return this.mcpToolProvider;
  }

  /**
   * Refresh MCP tools from all connected servers
   */
  async refreshMCPTools(): Promise<void> {
    if (!this.mcpToolProvider || !this.mcpManager) {
      throw new Error('MCP not initialized. Call initializeMCP() first.');
    }

    // Remove old MCP tools
    for (const tool of this.tools.values()) {
      if (tool.name.startsWith('mcp__')) {
        this.tools.delete(tool.name);
      }
    }

    // Refresh and re-register
    await this.mcpToolProvider.refresh();
    this.registerTools(this.mcpToolProvider.getTools());
  }

  /**
   * Close MCP connections
   */
  async closeMCP(): Promise<void> {
    if (this.mcpManager) {
      await this.mcpManager.close();
      this.mcpManager = null;
      this.mcpToolProvider = null;

      // Remove MCP tools
      for (const tool of this.tools.values()) {
        if (tool.name.startsWith('mcp__')) {
          this.tools.delete(tool.name);
        }
      }
    }
  }

  // ============================================
  // Skill Integration
  // ============================================

  /**
   * Initialize Skills
   * Call this before using Skill tools, or set autoLoad: true in config
   */
  async initializeSkills(): Promise<void> {
    if (!this.skillConfig) {
      throw new Error('No Skill configuration provided');
    }

    this.skillManager = new SkillManager();

    // Build skill config
    let skillConfig: SkillConfig;
    if (this.skillConfig.configPath) {
      // Load from file
      const { loadConfig } = await import('@agent-stack/skill');
      skillConfig = await loadConfig(this.skillConfig.configPath);
    } else if (this.skillConfig.skills) {
      // Use inline config
      skillConfig = {
        skills: this.skillConfig.skills,
        autoLoad: this.skillConfig.autoLoad,
      };
    } else {
      // Empty config - will rely on directory discovery
      skillConfig = { skills: {} };
    }

    await this.skillManager.initialize(skillConfig);

    // Load from configured skills
    if (skillConfig.autoLoad !== false && Object.keys(skillConfig.skills).length > 0) {
      await this.skillManager.loadAll();
    }

    // Discover and load from directories if specified
    if (this.skillConfig.directories) {
      for (const dir of this.skillConfig.directories) {
        await this.skillManager.discoverAndLoad(dir);
      }
    }

    // Activate all loaded skills
    for (const skillName of this.skillManager.getSkillNames()) {
      await this.skillManager.activate(skillName);
    }

    // Create tool provider with default options
    const toolOptions = this.skillConfig.toolOptions ?? {
      nameTransformer: (skill, tool) => `skill__${skill}__${tool}`,
    };
    this.skillToolProvider = new SkillToolProvider(this.skillManager, toolOptions);

    // Register skill tools
    this.registerTools(this.skillToolProvider.getTools());
  }

  /**
   * Get the Skill Manager (for advanced usage)
   */
  getSkillManager(): SkillManager | null {
    return this.skillManager;
  }

  /**
   * Get the Skill tool provider (for advanced usage)
   */
  getSkillToolProvider(): SkillToolProvider | null {
    return this.skillToolProvider;
  }

  /**
   * Refresh Skill tools
   */
  async refreshSkillTools(): Promise<void> {
    if (!this.skillToolProvider || !this.skillManager) {
      throw new Error('Skills not initialized. Call initializeSkills() first.');
    }

    // Remove old skill tools
    for (const tool of this.tools.values()) {
      if (tool.name.startsWith('skill__')) {
        this.tools.delete(tool.name);
      }
    }

    // Refresh and re-register
    await this.skillToolProvider.refresh();
    this.registerTools(this.skillToolProvider.getTools());
  }

  /**
   * Close Skill manager
   */
  async closeSkills(): Promise<void> {
    if (this.skillManager) {
      await this.skillManager.close();
      this.skillManager = null;
      this.skillToolProvider = null;

      // Remove skill tools
      for (const tool of this.tools.values()) {
        if (tool.name.startsWith('skill__')) {
          this.tools.delete(tool.name);
        }
      }
    }
  }

  // ============================================
  // Memory Integration
  // ============================================

  /**
   * Initialize Memory system
   * Call this before using memory features, or set autoInitialize: true in config
   */
  async initializeMemory(): Promise<void> {
    if (!this.memoryConfig || !this.memoryConfig.enabled) {
      throw new Error('No Memory configuration provided or memory is disabled');
    }

    // Build memory config
    const config: Partial<MemoryConfig> = {
      dbPath: this.memoryConfig.dbPath ?? '.agent-stack/memory.db',
      debug: this.memoryConfig.debug ?? false,
    };

    if (this.memoryConfig.tokenBudget) {
      config.tokenBudget = {
        profile: 200,
        taskState: 300,
        recentEvents: 500,
        semanticChunks: 800,
        summary: 400,
        total: 2200,
        ...this.memoryConfig.tokenBudget,
      };
    }

    if (this.memoryConfig.writePolicy) {
      config.writePolicy = {
        minConfidence: 0.5,
        autoSummarize: true,
        summarizeEveryNEvents: 20,
        summarizeTokenThreshold: 4000,
        profileKeyWhitelist: null,
        conflictStrategy: 'latest',
        timeDecayFactor: 0.9,
        staleThresholdMs: 7 * 24 * 60 * 60 * 1000,
        ...this.memoryConfig.writePolicy,
      };
    }

    if (this.memoryConfig.retrieval) {
      config.retrieval = {
        maxRecentEvents: 10,
        maxSemanticChunks: 5,
        recentEventsWindowMs: 30 * 60 * 1000,
        enableSemanticSearch: this.memoryConfig.enableSemanticSearch ?? false,
        enableFtsSearch: true,
        enableRerank: true,
        ...this.memoryConfig.retrieval,
      };
    }

    this.memoryManager = new MemoryManager(config);
    await this.memoryManager.initialize();
  }

  /**
   * Get the Memory Manager (for advanced usage)
   */
  getMemoryManager(): MemoryManager | null {
    return this.memoryManager;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.memoryManager?.getSessionId() ?? null;
  }

  /**
   * Start a new memory session
   */
  newSession(): string | null {
    if (!this.memoryManager) return null;
    this.clearHistory();
    return this.memoryManager.newSession();
  }

  /**
   * Retrieve memory bundle for current context
   */
  async retrieveMemory(query?: string): Promise<MemoryBundle | null> {
    if (!this.memoryManager) return null;
    return this.memoryManager.retrieve({ query });
  }

  /**
   * Get formatted memory context for prompt injection
   */
  async getMemoryContext(query?: string): Promise<string> {
    if (!this.memoryManager) return '';
    const bundle = await this.memoryManager.retrieve({ query });
    return this.memoryManager.inject(bundle);
  }

  /**
   * Close Memory manager
   */
  async closeMemory(): Promise<void> {
    if (this.memoryManager) {
      await this.memoryManager.close();
      this.memoryManager = null;
    }
  }

  // ============================================
  // Task Management
  // ============================================

  /**
   * Create a new task
   */
  async createTask(
    goal: string,
    options: {
      constraints?: TaskConstraint[];
      plan?: TaskStep[];
    } = {}
  ): Promise<TaskState | null> {
    if (!this.memoryManager) return null;

    return this.memoryManager.createTask({
      goal,
      status: 'pending',
      constraints: options.constraints || [],
      plan: options.plan || [],
      done: [],
      blocked: [],
      sessionId: this.memoryManager.getSessionId(),
    });
  }

  /**
   * Get current active task
   */
  async getCurrentTask(): Promise<TaskState | null> {
    if (!this.memoryManager) return null;
    return this.memoryManager.getCurrentTask();
  }

  /**
   * Update current task
   */
  async updateTask(
    taskId: string,
    update: Partial<TaskState> & { actionId?: string }
  ): Promise<TaskState | null> {
    if (!this.memoryManager) return null;
    return this.memoryManager.updateTask(taskId, update);
  }

  /**
   * Add a step to the current task's plan
   */
  async addTaskStep(step: Omit<TaskStep, 'id' | 'status'>): Promise<TaskState | null> {
    const task = await this.getCurrentTask();
    if (!task) return null;

    const newStep: TaskStep = {
      ...step,
      id: this.taskReducer.createStepId(),
      status: 'pending',
    };

    const result = this.taskReducer.reduce(task, TaskActions.addStep(newStep));
    return this.updateTask(task.id, {
      plan: result.state.plan,
      actionId: `add-step-${newStep.id}`,
    });
  }

  /**
   * Mark a task step as completed
   */
  async completeTaskStep(stepId: string, result?: string): Promise<TaskState | null> {
    const task = await this.getCurrentTask();
    if (!task) return null;

    const reducerResult = this.taskReducer.reduce(
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

    if (this.taskReducer.isCompleted(reducerResult.state)) {
      updates.status = 'completed';
    }

    return this.updateTask(task.id, updates);
  }

  /**
   * Block a task step
   */
  async blockTaskStep(stepId: string, reason: string): Promise<TaskState | null> {
    const task = await this.getCurrentTask();
    if (!task) return null;

    const reducerResult = this.taskReducer.reduce(
      task,
      TaskActions.blockStep(stepId, reason)
    );

    return this.updateTask(task.id, {
      plan: reducerResult.state.plan,
      blocked: reducerResult.state.blocked,
      nextAction: reducerResult.state.nextAction,
      actionId: reducerResult.actionId,
    });
  }

  /**
   * Unblock a task step
   */
  async unblockTaskStep(stepId: string): Promise<TaskState | null> {
    const task = await this.getCurrentTask();
    if (!task) return null;

    const reducerResult = this.taskReducer.reduce(
      task,
      TaskActions.unblockStep(stepId)
    );

    return this.updateTask(task.id, {
      plan: reducerResult.state.plan,
      blocked: reducerResult.state.blocked,
      actionId: `unblock-${stepId}-${Date.now()}`,
    });
  }

  /**
   * Get task progress
   */
  async getTaskProgress(): Promise<{ percentage: number; done: number; total: number } | null> {
    const task = await this.getCurrentTask();
    if (!task) return null;

    return {
      percentage: this.taskReducer.getProgress(task),
      done: task.done.length,
      total: task.plan.length,
    };
  }

  /**
   * Get next actionable step
   */
  async getNextStep(): Promise<TaskStep | null> {
    const task = await this.getCurrentTask();
    if (!task) return null;
    return this.taskReducer.getNextStep(task);
  }

  /**
   * Set task status
   */
  async setTaskStatus(status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'blocked'): Promise<TaskState | null> {
    const task = await this.getCurrentTask();
    if (!task) return null;

    return this.updateTask(task.id, {
      status,
      actionId: `set-status-${status}-${Date.now()}`,
    });
  }

  // ============================================
  // Profile Management
  // ============================================

  /**
   * Set a user profile preference
   */
  async setProfile(
    key: string,
    value: unknown,
    options: { confidence?: number; explicit?: boolean; expiresAt?: number } = {}
  ): Promise<unknown | null> {
    if (!this.memoryManager) return null;

    const item = await this.memoryManager.setProfile({
      key,
      value,
      confidence: options.confidence ?? 0.8,
      explicit: options.explicit ?? true,
      expiresAt: options.expiresAt,
    });

    return item.value;
  }

  /**
   * Get a user profile preference
   */
  async getProfile(key: string): Promise<unknown | null> {
    if (!this.memoryManager) return null;
    const item = await this.memoryManager.getProfile(key);
    return item?.value ?? null;
  }

  /**
   * Get all user profile preferences
   */
  async getAllProfiles(): Promise<Record<string, unknown>> {
    if (!this.memoryManager) return {};
    const items = await this.memoryManager.getAllProfiles();
    const result: Record<string, unknown> = {};
    for (const item of items) {
      result[item.key] = item.value;
    }
    return result;
  }

  /**
   * Close all resources (MCP, Skills, Memory)
   */
  async close(): Promise<void> {
    await Promise.all([
      this.closeMCP(),
      this.closeSkills(),
      this.closeMemory(),
    ]);
  }

  /**
   * Get the agent's name
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * Update agent configuration
   */
  configure(config: Partial<AgentConfig>): void {
    if (config.name !== undefined) this.config.name = config.name;
    if (config.systemPrompt !== undefined) this.config.systemPrompt = config.systemPrompt;
    if (config.model !== undefined) this.config.model = config.model;
    if (config.temperature !== undefined) this.config.temperature = config.temperature;
    if (config.maxTokens !== undefined) this.config.maxTokens = config.maxTokens;
  }

  /**
   * Register a tool that the agent can use
   */
  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Register multiple tools at once
   */
  registerTools(tools: Tool[]): void {
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  /**
   * Remove a registered tool
   */
  removeTool(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Get all registered tools
   */
  getTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Get conversation history
   */
  getHistory(): ChatCompletionMessageParam[] {
    return [...this.conversationHistory];
  }

  /**
   * Add a message to conversation history
   */
  addMessage(message: ChatCompletionMessageParam): void {
    this.conversationHistory.push(message);
  }

  /**
   * Send a message and get a response
   */
  async chat(
    input: string,
    options: ConversationOptions = {}
  ): Promise<AgentResponse> {
    // Auto-initialize MCP if configured with autoConnect
    if (this.mcpConfig?.autoConnect && !this.mcpManager) {
      await this.initializeMCP();
    }

    // Auto-initialize Skills if configured with autoLoad
    if (this.skillConfig?.autoLoad && !this.skillManager) {
      await this.initializeSkills();
    }

    // Auto-initialize Memory if configured with autoInitialize
    if (this.memoryConfig?.enabled && this.memoryConfig.autoInitialize !== false && !this.memoryManager) {
      await this.initializeMemory();
    }

    const { maxIterations = 10, signal } = options;

    // Record user message to memory
    if (this.memoryManager) {
      const observer = this.memoryManager.getObserver();
      await this.memoryManager.recordEvent(
        observer.createUserMessageEvent(input)
      );
    }

    // Add user message to history
    this.conversationHistory.push(userMessage(input));

    // Build system prompt with memory context
    let effectiveSystemPrompt = this.config.systemPrompt;
    if (this.memoryManager && this.memoryConfig?.autoInject !== false) {
      const memoryContext = await this.getMemoryContext(input);
      if (memoryContext) {
        effectiveSystemPrompt = `${this.config.systemPrompt}\n\n---\n\n## Memory Context\n\n${memoryContext}`;
      }
    }

    // Build messages with system prompt
    const messages: ChatCompletionMessageParam[] = [
      systemMessage(effectiveSystemPrompt),
      ...this.conversationHistory,
    ];

    // Build tools array
    const toolsArray = this.tools.size > 0
      ? Array.from(this.tools.values()).map((tool) =>
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

      const response = await this.client.chat(messages, {
        model: this.config.model,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        tools: toolsArray,
      });

      // If no tool calls, we're done
      if (!response.toolCalls || response.toolCalls.length === 0) {
        const content = response.content ?? '';
        this.conversationHistory.push(assistantMessage(content));

        // Record assistant message to memory
        if (this.memoryManager) {
          const observer = this.memoryManager.getObserver();
          await this.memoryManager.recordEvent(
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
        const tool = this.tools.get(toolCall.function.name);
        if (!tool) {
          const errorResult = `Error: Unknown tool "${toolCall.function.name}"`;
          messages.push(toolMessage(toolCall.id, errorResult));
          continue;
        }

        try {
          const args = JSON.parse(toolCall.function.arguments);

          // Record tool call to memory
          let toolCallEventId: string | undefined;
          if (this.memoryManager) {
            const observer = this.memoryManager.getObserver();
            const event = await this.memoryManager.recordEvent(
              observer.createToolCallEvent(toolCall.function.name, args)
            );
            toolCallEventId = event.id;
          }

          const result = await tool.execute(args);

          // Record tool result to memory
          if (this.memoryManager) {
            const observer = this.memoryManager.getObserver();
            await this.memoryManager.recordEvent(
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
  }

  /**
   * Send a message and stream the response
   */
  async stream(
    input: string,
    callbacks: StreamCallbacks = {},
    options: ConversationOptions = {}
  ): Promise<AgentResponse> {
    // Auto-initialize MCP if configured with autoConnect
    if (this.mcpConfig?.autoConnect && !this.mcpManager) {
      await this.initializeMCP();
    }

    const { maxIterations = 10, signal } = options;
    const { onToken, onToolCall, onToolResult, onComplete, onError } = callbacks;

    // Auto-initialize Skills if configured with autoLoad
    if (this.skillConfig?.autoLoad && !this.skillManager) {
      await this.initializeSkills();
    }

    // Auto-initialize Memory if configured with autoInitialize
    if (this.memoryConfig?.enabled && this.memoryConfig.autoInitialize !== false && !this.memoryManager) {
      await this.initializeMemory();
    }

    try {
      // Record user message to memory
      if (this.memoryManager) {
        const observer = this.memoryManager.getObserver();
        await this.memoryManager.recordEvent(
          observer.createUserMessageEvent(input)
        );
      }

      // Add user message to history
      this.conversationHistory.push(userMessage(input));

      // Build system prompt with memory context
      let effectiveSystemPrompt = this.config.systemPrompt;
      if (this.memoryManager && this.memoryConfig?.autoInject !== false) {
        const memoryContext = await this.getMemoryContext(input);
        if (memoryContext) {
          effectiveSystemPrompt = `${this.config.systemPrompt}\n\n---\n\n## Memory Context\n\n${memoryContext}`;
        }
      }

      // Build messages with system prompt
      const messages: ChatCompletionMessageParam[] = [
        systemMessage(effectiveSystemPrompt),
        ...this.conversationHistory,
      ];

      // Build tools array
      const toolsArray = this.tools.size > 0
        ? Array.from(this.tools.values()).map((tool) =>
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

        const stream = this.client.chatStream(messages, {
          model: this.config.model,
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens,
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
          this.conversationHistory.push(assistantMessage(fullContent));

          // Record assistant message to memory
          if (this.memoryManager) {
            const observer = this.memoryManager.getObserver();
            await this.memoryManager.recordEvent(
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
          const tool = this.tools.get(toolCall.function.name);

          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch {
            // Ignore parse errors
          }

          onToolCall?.(toolCall.function.name, args);

          // Record tool call to memory
          let toolCallEventId: string | undefined;
          if (this.memoryManager) {
            const observer = this.memoryManager.getObserver();
            const event = await this.memoryManager.recordEvent(
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
            if (this.memoryManager) {
              const observer = this.memoryManager.getObserver();
              await this.memoryManager.recordEvent(
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
  }

  /**
   * Single-turn completion without conversation history
   */
  async complete(
    prompt: string,
    systemPromptOverride?: string
  ): Promise<string> {
    const response = await this.client.chat(
      [
        systemMessage(systemPromptOverride ?? this.config.systemPrompt),
        userMessage(prompt),
      ],
      {
        model: this.config.model,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
      }
    );

    return response.content ?? '';
  }
}
