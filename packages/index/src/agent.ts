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
import type {
  AgentConfig,
  AgentMCPConfig,
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

    const { maxIterations = 10, signal } = options;

    // Add user message to history
    this.conversationHistory.push(userMessage(input));

    // Build messages with system prompt
    const messages: ChatCompletionMessageParam[] = [
      systemMessage(this.config.systemPrompt),
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
          const result = await tool.execute(args);

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

    try {
      // Add user message to history
      this.conversationHistory.push(userMessage(input));

      // Build messages with system prompt
      const messages: ChatCompletionMessageParam[] = [
        systemMessage(this.config.systemPrompt),
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

          if (!tool) {
            const errorResult = `Error: Unknown tool "${toolCall.function.name}"`;
            messages.push(toolMessage(toolCall.id, errorResult));
            onToolResult?.(toolCall.function.name, errorResult);
            continue;
          }

          try {
            const result = await tool.execute(args);

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
