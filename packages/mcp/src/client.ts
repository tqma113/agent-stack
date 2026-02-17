/**
 * @agent-stack/mcp - MCP Client Manager
 *
 * Manages multiple MCP server connections with lifecycle management
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type {
  MCPConfig,
  MCPServerConfig,
  MCPServerConnection,
  MCPClientManagerOptions,
  MCPConnectionState,
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPToolResult,
  MCPToolCallOptions,
  MCPResourceContent,
  MCPPromptMessage,
  MCPEventHandler,
  MCPEventType,
} from './types';
import { MCPConnectionError, MCPToolExecutionError } from './types';
import { loadConfig, loadConfigFromDefaults } from './config';
import { createTransport, type MCPTransport } from './transport';
import { withTimeout, parseToolResultContent } from './helpers';

/**
 * Default timeout for operations (30 seconds)
 */
const DEFAULT_TIMEOUT = 30000;

/**
 * MCPClientManager - Manages multiple MCP server connections
 */
export class MCPClientManager {
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, MCPTransport> = new Map();
  private connections: Map<string, MCPServerConnection> = new Map();
  private config: MCPConfig | null = null;
  private options: MCPClientManagerOptions;
  private eventHandlers: Map<MCPEventType, Set<MCPEventHandler>> = new Map();

  constructor(options: MCPClientManagerOptions = {}) {
    this.options = options;
  }

  // ============================================
  // Lifecycle Methods
  // ============================================

  /**
   * Initialize manager with configuration
   * Loads config from file if string path provided
   */
  async initialize(config?: MCPConfig | string): Promise<void> {
    if (typeof config === 'string') {
      this.config = await loadConfig(config);
    } else if (config) {
      this.config = config;
    } else {
      const loadedConfig = await loadConfigFromDefaults();
      if (!loadedConfig) {
        throw new Error(
          'No MCP configuration found. Provide a config or create mcp.json'
        );
      }
      this.config = loadedConfig;
    }

    // Initialize connection states
    for (const [name, serverConfig] of Object.entries(
      this.config.mcpServers
    )) {
      this.connections.set(name, {
        name,
        config: serverConfig,
        state: 'disconnected',
        tools: [],
        resources: [],
        prompts: [],
      });
    }
  }

  /**
   * Connect to all configured servers
   */
  async connectAll(): Promise<void> {
    if (!this.config) {
      throw new Error('Manager not initialized. Call initialize() first.');
    }

    const serverNames = Object.keys(this.config.mcpServers);
    const results = await Promise.allSettled(
      serverNames.map((name) => this.connect(name))
    );

    // Log any connection failures
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'rejected') {
        console.error(
          `Failed to connect to ${serverNames[i]}:`,
          result.reason
        );
      }
    }
  }

  /**
   * Connect to a specific server
   */
  async connect(serverName: string): Promise<void> {
    if (!this.config) {
      throw new Error('Manager not initialized. Call initialize() first.');
    }

    const serverConfig = this.config.mcpServers[serverName];
    if (!serverConfig) {
      throw new Error(`Unknown server: ${serverName}`);
    }

    const connection = this.connections.get(serverName);
    if (!connection) {
      throw new Error(`Connection not found for server: ${serverName}`);
    }

    // Update state
    this.updateConnectionState(serverName, 'connecting');

    try {
      // Create transport
      const transport = createTransport(serverConfig);
      this.transports.set(serverName, transport);

      // Create client
      const client = new Client(
        {
          name: `agent-stack-mcp-${serverName}`,
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Connect
      const timeout = serverConfig.timeout ?? this.options.defaultTimeout ?? DEFAULT_TIMEOUT;
      await withTimeout(
        client.connect(transport),
        timeout,
        `connect to ${serverName}`
      );

      this.clients.set(serverName, client);

      // Update state
      this.updateConnectionState(serverName, 'connected');

      // Refresh capabilities
      await this.refreshServerCapabilities(serverName);
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error(String(error));
      this.updateConnectionState(serverName, 'error', err);
      throw new MCPConnectionError(serverName, err);
    }
  }

  /**
   * Disconnect from a specific server
   */
  async disconnect(serverName: string): Promise<void> {
    const client = this.clients.get(serverName);
    const transport = this.transports.get(serverName);

    if (client) {
      try {
        await client.close();
      } catch {
        // Ignore close errors
      }
      this.clients.delete(serverName);
    }

    if (transport) {
      try {
        await transport.close();
      } catch {
        // Ignore close errors
      }
      this.transports.delete(serverName);
    }

    this.updateConnectionState(serverName, 'disconnected');
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    const serverNames = Array.from(this.clients.keys());
    await Promise.all(serverNames.map((name) => this.disconnect(name)));
  }

  /**
   * Reconnect to a server
   */
  async reconnect(serverName: string): Promise<void> {
    await this.disconnect(serverName);
    await this.connect(serverName);
  }

  /**
   * Cleanup and close all connections
   */
  async close(): Promise<void> {
    await this.disconnectAll();
    this.config = null;
    this.connections.clear();
    this.eventHandlers.clear();
  }

  // ============================================
  // Server Information
  // ============================================

  /**
   * Get all server names
   */
  getServerNames(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Get connection info for a server
   */
  getConnection(serverName: string): MCPServerConnection | undefined {
    return this.connections.get(serverName);
  }

  /**
   * Get all connections
   */
  getAllConnections(): MCPServerConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Check if server is connected
   */
  isConnected(serverName: string): boolean {
    const connection = this.connections.get(serverName);
    return connection?.state === 'connected';
  }

  /**
   * Get connection state for a server
   */
  getState(serverName: string): MCPConnectionState {
    return this.connections.get(serverName)?.state ?? 'disconnected';
  }

  // ============================================
  // Tools
  // ============================================

  /**
   * List tools from a specific server
   */
  async listTools(serverName: string): Promise<MCPTool[]> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`Not connected to server: ${serverName}`);
    }

    const result = await client.listTools();
    const tools: MCPTool[] = result.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as MCPTool['inputSchema'],
    }));

    // Update connection
    const connection = this.connections.get(serverName);
    if (connection) {
      connection.tools = tools;
      this.emit('tools:change', serverName, tools);
    }

    return tools;
  }

  /**
   * List tools from all connected servers
   */
  async listAllTools(): Promise<Map<string, MCPTool[]>> {
    const result = new Map<string, MCPTool[]>();

    for (const serverName of this.clients.keys()) {
      try {
        const tools = await this.listTools(serverName);
        result.set(serverName, tools);
      } catch (error) {
        console.error(`Failed to list tools from ${serverName}:`, error);
        result.set(serverName, []);
      }
    }

    return result;
  }

  /**
   * Call a tool on a specific server
   */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
    options?: MCPToolCallOptions
  ): Promise<MCPToolResult> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`Not connected to server: ${serverName}`);
    }

    try {
      const timeout =
        options?.timeout ?? this.options.defaultTimeout ?? DEFAULT_TIMEOUT;

      const result = await withTimeout(
        client.callTool({ name: toolName, arguments: args }),
        timeout,
        `call tool ${toolName}`
      );

      return {
        content: (result.content as MCPToolResult['content']) ?? [],
        isError: result.isError as boolean | undefined,
      };
    } catch (error) {
      throw new MCPToolExecutionError(
        serverName,
        toolName,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Find which server has a specific tool
   */
  findToolServer(toolName: string): string | undefined {
    for (const [serverName, connection] of this.connections) {
      if (connection.tools.some((t) => t.name === toolName)) {
        return serverName;
      }
    }
    return undefined;
  }

  // ============================================
  // Resources
  // ============================================

  /**
   * List resources from a specific server
   */
  async listResources(serverName: string): Promise<MCPResource[]> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`Not connected to server: ${serverName}`);
    }

    const result = await client.listResources();
    const resources: MCPResource[] = result.resources.map((r) => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType,
    }));

    // Update connection
    const connection = this.connections.get(serverName);
    if (connection) {
      connection.resources = resources;
      this.emit('resources:change', serverName, resources);
    }

    return resources;
  }

  /**
   * List resources from all connected servers
   */
  async listAllResources(): Promise<Map<string, MCPResource[]>> {
    const result = new Map<string, MCPResource[]>();

    for (const serverName of this.clients.keys()) {
      try {
        const resources = await this.listResources(serverName);
        result.set(serverName, resources);
      } catch (error) {
        console.error(`Failed to list resources from ${serverName}:`, error);
        result.set(serverName, []);
      }
    }

    return result;
  }

  /**
   * Read a resource from a specific server
   */
  async readResource(
    serverName: string,
    uri: string
  ): Promise<MCPResourceContent> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`Not connected to server: ${serverName}`);
    }

    const result = await client.readResource({ uri });
    const content = result.contents[0];

    return {
      uri,
      mimeType: content?.mimeType,
      text: content && 'text' in content ? content.text : undefined,
      blob: content && 'blob' in content ? content.blob : undefined,
    };
  }

  // ============================================
  // Prompts
  // ============================================

  /**
   * List prompts from a specific server
   */
  async listPrompts(serverName: string): Promise<MCPPrompt[]> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`Not connected to server: ${serverName}`);
    }

    const result = await client.listPrompts();
    const prompts: MCPPrompt[] = result.prompts.map((p) => ({
      name: p.name,
      description: p.description,
      arguments: p.arguments?.map((arg) => ({
        name: arg.name,
        description: arg.description,
        required: arg.required,
      })),
    }));

    // Update connection
    const connection = this.connections.get(serverName);
    if (connection) {
      connection.prompts = prompts;
    }

    return prompts;
  }

  /**
   * List prompts from all connected servers
   */
  async listAllPrompts(): Promise<Map<string, MCPPrompt[]>> {
    const result = new Map<string, MCPPrompt[]>();

    for (const serverName of this.clients.keys()) {
      try {
        const prompts = await this.listPrompts(serverName);
        result.set(serverName, prompts);
      } catch (error) {
        console.error(`Failed to list prompts from ${serverName}:`, error);
        result.set(serverName, []);
      }
    }

    return result;
  }

  /**
   * Get a prompt from a specific server
   */
  async getPrompt(
    serverName: string,
    promptName: string,
    args?: Record<string, string>
  ): Promise<MCPPromptMessage[]> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`Not connected to server: ${serverName}`);
    }

    const result = await client.getPrompt({ name: promptName, arguments: args });

    return result.messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content as MCPPromptMessage['content'],
    }));
  }

  // ============================================
  // Events
  // ============================================

  /**
   * Subscribe to events
   */
  on(event: MCPEventType, handler: MCPEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Unsubscribe from events
   */
  off(event: MCPEventType, handler: MCPEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Emit an event
   */
  private emit(
    type: MCPEventType,
    serverName: string,
    data?: unknown,
    error?: Error
  ): void {
    const handlers = this.eventHandlers.get(type);
    if (handlers) {
      const event = { type, serverName, data, error };
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (err) {
          console.error('Event handler error:', err);
        }
      }
    }

    // Also call options callbacks
    if (type === 'connection:change' && this.options.onConnectionChange) {
      this.options.onConnectionChange(
        serverName,
        this.getState(serverName),
        error
      );
    }

    if (type === 'tools:change' && this.options.onToolsChange) {
      this.options.onToolsChange(serverName, data as MCPTool[]);
    }
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Update connection state
   */
  private updateConnectionState(
    serverName: string,
    state: MCPConnectionState,
    error?: Error
  ): void {
    const connection = this.connections.get(serverName);
    if (connection) {
      connection.state = state;
      connection.error = error;
      this.emit('connection:change', serverName, state, error);
    }
  }

  /**
   * Refresh server capabilities (tools, resources, prompts)
   */
  private async refreshServerCapabilities(serverName: string): Promise<void> {
    try {
      await Promise.all([
        this.listTools(serverName).catch(() => []),
        this.listResources(serverName).catch(() => []),
        this.listPrompts(serverName).catch(() => []),
      ]);
    } catch (error) {
      console.error(`Failed to refresh capabilities for ${serverName}:`, error);
    }
  }
}
