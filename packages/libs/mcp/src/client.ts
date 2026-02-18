/**
 * @ai-stack/mcp - MCP Client Manager
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
 * MCP Client Manager instance type (returned by factory)
 */
export interface MCPClientManagerInstance {
  // Lifecycle Methods
  initialize(config?: MCPConfig | string): Promise<void>;
  connectAll(): Promise<void>;
  connect(serverName: string): Promise<void>;
  disconnect(serverName: string): Promise<void>;
  disconnectAll(): Promise<void>;
  reconnect(serverName: string): Promise<void>;
  close(): Promise<void>;

  // Server Information
  getServerNames(): string[];
  getConnection(serverName: string): MCPServerConnection | undefined;
  getAllConnections(): MCPServerConnection[];
  isConnected(serverName: string): boolean;
  getState(serverName: string): MCPConnectionState;

  // Tools
  listTools(serverName: string): Promise<MCPTool[]>;
  listAllTools(): Promise<Map<string, MCPTool[]>>;
  callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
    options?: MCPToolCallOptions
  ): Promise<MCPToolResult>;
  findToolServer(toolName: string): string | undefined;

  // Resources
  listResources(serverName: string): Promise<MCPResource[]>;
  listAllResources(): Promise<Map<string, MCPResource[]>>;
  readResource(serverName: string, uri: string): Promise<MCPResourceContent>;

  // Prompts
  listPrompts(serverName: string): Promise<MCPPrompt[]>;
  listAllPrompts(): Promise<Map<string, MCPPrompt[]>>;
  getPrompt(
    serverName: string,
    promptName: string,
    args?: Record<string, string>
  ): Promise<MCPPromptMessage[]>;

  // Events
  on(event: MCPEventType, handler: MCPEventHandler): void;
  off(event: MCPEventType, handler: MCPEventHandler): void;
}

/**
 * Create an MCP Client Manager instance
 */
export function createMCPClientManager(
  options: MCPClientManagerOptions = {}
): MCPClientManagerInstance {
  // Private state via closure
  const clients = new Map<string, Client>();
  const transports = new Map<string, MCPTransport>();
  const connections = new Map<string, MCPServerConnection>();
  let config: MCPConfig | null = null;
  const eventHandlers = new Map<MCPEventType, Set<MCPEventHandler>>();

  // Private helper functions
  function emit(
    type: MCPEventType,
    serverName: string,
    data?: unknown,
    error?: Error
  ): void {
    const handlers = eventHandlers.get(type);
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
    if (type === 'connection:change' && options.onConnectionChange) {
      options.onConnectionChange(
        serverName,
        connections.get(serverName)?.state ?? 'disconnected',
        error
      );
    }

    if (type === 'tools:change' && options.onToolsChange) {
      options.onToolsChange(serverName, data as MCPTool[]);
    }
  }

  function updateConnectionState(
    serverName: string,
    state: MCPConnectionState,
    error?: Error
  ): void {
    const connection = connections.get(serverName);
    if (connection) {
      connection.state = state;
      connection.error = error;
      emit('connection:change', serverName, state, error);
    }
  }

  async function refreshServerCapabilities(serverName: string): Promise<void> {
    try {
      await Promise.all([
        instance.listTools(serverName).catch(() => []),
        instance.listResources(serverName).catch(() => []),
        instance.listPrompts(serverName).catch(() => []),
      ]);
    } catch (error) {
      console.error(`Failed to refresh capabilities for ${serverName}:`, error);
    }
  }

  // Instance object
  const instance: MCPClientManagerInstance = {
    // ============================================
    // Lifecycle Methods
    // ============================================

    async initialize(inputConfig?: MCPConfig | string): Promise<void> {
      if (typeof inputConfig === 'string') {
        config = await loadConfig(inputConfig);
      } else if (inputConfig) {
        config = inputConfig;
      } else {
        const loadedConfig = await loadConfigFromDefaults();
        if (!loadedConfig) {
          throw new Error(
            'No MCP configuration found. Provide a config or create mcp.json'
          );
        }
        config = loadedConfig;
      }

      // Initialize connection states
      for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
        connections.set(name, {
          name,
          config: serverConfig,
          state: 'disconnected',
          tools: [],
          resources: [],
          prompts: [],
        });
      }
    },

    async connectAll(): Promise<void> {
      if (!config) {
        throw new Error('Manager not initialized. Call initialize() first.');
      }

      const serverNames = Object.keys(config.mcpServers);
      const results = await Promise.allSettled(
        serverNames.map((name) => instance.connect(name))
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
    },

    async connect(serverName: string): Promise<void> {
      if (!config) {
        throw new Error('Manager not initialized. Call initialize() first.');
      }

      const serverConfig = config.mcpServers[serverName];
      if (!serverConfig) {
        throw new Error(`Unknown server: ${serverName}`);
      }

      const connection = connections.get(serverName);
      if (!connection) {
        throw new Error(`Connection not found for server: ${serverName}`);
      }

      // Update state
      updateConnectionState(serverName, 'connecting');

      try {
        // Create transport
        const transport = createTransport(serverConfig);
        transports.set(serverName, transport);

        // Create client
        const client = new Client(
          {
            name: `ai-stack-mcp-${serverName}`,
            version: '1.0.0',
          },
          {
            capabilities: {},
          }
        );

        // Connect
        const timeout =
          serverConfig.timeout ?? options.defaultTimeout ?? DEFAULT_TIMEOUT;
        await withTimeout(
          client.connect(transport),
          timeout,
          `connect to ${serverName}`
        );

        clients.set(serverName, client);

        // Update state
        updateConnectionState(serverName, 'connected');

        // Refresh capabilities
        await refreshServerCapabilities(serverName);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        updateConnectionState(serverName, 'error', err);
        throw new MCPConnectionError(serverName, err);
      }
    },

    async disconnect(serverName: string): Promise<void> {
      const client = clients.get(serverName);
      const transport = transports.get(serverName);

      if (client) {
        try {
          await client.close();
        } catch {
          // Ignore close errors
        }
        clients.delete(serverName);
      }

      if (transport) {
        try {
          await transport.close();
        } catch {
          // Ignore close errors
        }
        transports.delete(serverName);
      }

      updateConnectionState(serverName, 'disconnected');
    },

    async disconnectAll(): Promise<void> {
      const serverNames = Array.from(clients.keys());
      await Promise.all(serverNames.map((name) => instance.disconnect(name)));
    },

    async reconnect(serverName: string): Promise<void> {
      await instance.disconnect(serverName);
      await instance.connect(serverName);
    },

    async close(): Promise<void> {
      await instance.disconnectAll();
      config = null;
      connections.clear();
      eventHandlers.clear();
    },

    // ============================================
    // Server Information
    // ============================================

    getServerNames(): string[] {
      return Array.from(connections.keys());
    },

    getConnection(serverName: string): MCPServerConnection | undefined {
      return connections.get(serverName);
    },

    getAllConnections(): MCPServerConnection[] {
      return Array.from(connections.values());
    },

    isConnected(serverName: string): boolean {
      const connection = connections.get(serverName);
      return connection?.state === 'connected';
    },

    getState(serverName: string): MCPConnectionState {
      return connections.get(serverName)?.state ?? 'disconnected';
    },

    // ============================================
    // Tools
    // ============================================

    async listTools(serverName: string): Promise<MCPTool[]> {
      const client = clients.get(serverName);
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
      const connection = connections.get(serverName);
      if (connection) {
        connection.tools = tools;
        emit('tools:change', serverName, tools);
      }

      return tools;
    },

    async listAllTools(): Promise<Map<string, MCPTool[]>> {
      const result = new Map<string, MCPTool[]>();

      for (const serverName of clients.keys()) {
        try {
          const tools = await instance.listTools(serverName);
          result.set(serverName, tools);
        } catch (error) {
          console.error(`Failed to list tools from ${serverName}:`, error);
          result.set(serverName, []);
        }
      }

      return result;
    },

    async callTool(
      serverName: string,
      toolName: string,
      args: Record<string, unknown>,
      callOptions?: MCPToolCallOptions
    ): Promise<MCPToolResult> {
      const client = clients.get(serverName);
      if (!client) {
        throw new Error(`Not connected to server: ${serverName}`);
      }

      try {
        const timeout =
          callOptions?.timeout ?? options.defaultTimeout ?? DEFAULT_TIMEOUT;

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
    },

    findToolServer(toolName: string): string | undefined {
      for (const [serverName, connection] of connections) {
        if (connection.tools.some((t) => t.name === toolName)) {
          return serverName;
        }
      }
      return undefined;
    },

    // ============================================
    // Resources
    // ============================================

    async listResources(serverName: string): Promise<MCPResource[]> {
      const client = clients.get(serverName);
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
      const connection = connections.get(serverName);
      if (connection) {
        connection.resources = resources;
        emit('resources:change', serverName, resources);
      }

      return resources;
    },

    async listAllResources(): Promise<Map<string, MCPResource[]>> {
      const result = new Map<string, MCPResource[]>();

      for (const serverName of clients.keys()) {
        try {
          const resources = await instance.listResources(serverName);
          result.set(serverName, resources);
        } catch (error) {
          console.error(`Failed to list resources from ${serverName}:`, error);
          result.set(serverName, []);
        }
      }

      return result;
    },

    async readResource(
      serverName: string,
      uri: string
    ): Promise<MCPResourceContent> {
      const client = clients.get(serverName);
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
    },

    // ============================================
    // Prompts
    // ============================================

    async listPrompts(serverName: string): Promise<MCPPrompt[]> {
      const client = clients.get(serverName);
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
      const connection = connections.get(serverName);
      if (connection) {
        connection.prompts = prompts;
      }

      return prompts;
    },

    async listAllPrompts(): Promise<Map<string, MCPPrompt[]>> {
      const result = new Map<string, MCPPrompt[]>();

      for (const serverName of clients.keys()) {
        try {
          const prompts = await instance.listPrompts(serverName);
          result.set(serverName, prompts);
        } catch (error) {
          console.error(`Failed to list prompts from ${serverName}:`, error);
          result.set(serverName, []);
        }
      }

      return result;
    },

    async getPrompt(
      serverName: string,
      promptName: string,
      args?: Record<string, string>
    ): Promise<MCPPromptMessage[]> {
      const client = clients.get(serverName);
      if (!client) {
        throw new Error(`Not connected to server: ${serverName}`);
      }

      const result = await client.getPrompt({
        name: promptName,
        arguments: args,
      });

      return result.messages.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content as MCPPromptMessage['content'],
      }));
    },

    // ============================================
    // Events
    // ============================================

    on(event: MCPEventType, handler: MCPEventHandler): void {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, new Set());
      }
      eventHandlers.get(event)!.add(handler);
    },

    off(event: MCPEventType, handler: MCPEventHandler): void {
      eventHandlers.get(event)?.delete(handler);
    },
  };

  return instance;
}

