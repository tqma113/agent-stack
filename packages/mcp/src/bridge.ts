/**
 * @agent-stack/mcp - Tool Bridge
 *
 * Converts MCP tools to Agent-compatible Tool interface
 */

import type {
  MCPTool,
  MCPToolBridgeOptions,
  BridgedTool,
  AgentTool,
  MCPResource,
  MCPResourceContent,
} from './types';
import type { MCPClientManagerInstance } from './client';
import {
  generateToolName,
  parseToolResultContent,
  formatErrorResult,
} from './helpers';

/**
 * Create Agent-compatible tools from all MCP servers
 */
export function createToolBridge(
  manager: MCPClientManagerInstance,
  options?: MCPToolBridgeOptions
): BridgedTool[] {
  const tools: BridgedTool[] = [];

  for (const connection of manager.getAllConnections()) {
    if (connection.state !== 'connected') {
      continue;
    }

    for (const mcpTool of connection.tools) {
      // Apply filter if provided
      if (options?.filter && !options.filter(connection.name, mcpTool)) {
        continue;
      }

      const bridgedTool = bridgeTool(manager, connection.name, mcpTool, options);
      tools.push(bridgedTool);
    }
  }

  return tools;
}

/**
 * Convert a single MCP tool to Agent tool
 */
export function bridgeTool(
  manager: MCPClientManagerInstance,
  serverName: string,
  mcpTool: MCPTool,
  options?: MCPToolBridgeOptions
): BridgedTool {
  const name = generateToolName(serverName, mcpTool.name, {
    prefix: options?.namePrefix,
    includeServerName: options?.includeServerName,
    transformer: options?.nameTransformer,
  });

  const description = mcpTool.description ?? `Tool: ${mcpTool.name}`;
  const parameters = convertInputSchema(mcpTool.inputSchema);

  return {
    name,
    description,
    parameters,
    mcpToolName: mcpTool.name,
    mcpServerName: serverName,
    execute: async (args: Record<string, unknown>): Promise<string> => {
      try {
        const result = await manager.callTool(serverName, mcpTool.name, args);
        return parseToolResultContent(result);
      } catch (error) {
        return formatErrorResult(error);
      }
    },
  };
}

/**
 * Convert MCP input schema to Agent parameters format
 */
export function convertInputSchema(
  inputSchema: MCPTool['inputSchema']
): Record<string, unknown> {
  return {
    type: inputSchema.type,
    properties: inputSchema.properties ?? {},
    required: inputSchema.required ?? [],
  };
}

/**
 * Resource accessor interface for getting MCP resources
 */
export interface MCPResourceAccessor {
  /** List all available resources across all servers */
  listResources(): Promise<Array<MCPResource & { serverName: string }>>;
  /** Read a specific resource (searches all servers) */
  readResource(uri: string): Promise<MCPResourceContent>;
  /** Read resource from specific server */
  readResourceFromServer(
    serverName: string,
    uri: string
  ): Promise<MCPResourceContent>;
}

/**
 * Create resource accessor for the manager
 */
export function createResourceAccessor(
  manager: MCPClientManagerInstance
): MCPResourceAccessor {
  return {
    async listResources(): Promise<
      Array<MCPResource & { serverName: string }>
    > {
      const result: Array<MCPResource & { serverName: string }> = [];

      for (const connection of manager.getAllConnections()) {
        if (connection.state !== 'connected') {
          continue;
        }

        for (const resource of connection.resources) {
          result.push({ ...resource, serverName: connection.name });
        }
      }

      return result;
    },

    async readResource(uri: string): Promise<MCPResourceContent> {
      // Find server that has this resource
      for (const connection of manager.getAllConnections()) {
        if (connection.state !== 'connected') {
          continue;
        }

        const hasResource = connection.resources.some((r) => r.uri === uri);
        if (hasResource) {
          return manager.readResource(connection.name, uri);
        }
      }

      throw new Error(`Resource not found: ${uri}`);
    },

    async readResourceFromServer(
      serverName: string,
      uri: string
    ): Promise<MCPResourceContent> {
      return manager.readResource(serverName, uri);
    },
  };
}

/**
 * MCP Tool Provider instance type (returned by factory)
 */
export interface MCPToolProviderInstance {
  /** Get all bridged tools as Agent Tool array */
  getTools(): AgentTool[];
  /** Get tools from a specific server */
  getToolsFromServer(serverName: string): AgentTool[];
  /** Refresh tools from all servers */
  refresh(): Promise<void>;
  /** Find tool by name */
  findTool(name: string): BridgedTool | undefined;
  /** Get resource accessor */
  getResourceAccessor(): MCPResourceAccessor;
  /** Get tool count */
  readonly count: number;
  /** Get server names that have tools */
  getServersWithTools(): string[];
}

/**
 * Create an MCP Tool Provider instance
 */
export function createMCPToolProvider(
  manager: MCPClientManagerInstance,
  options: MCPToolBridgeOptions = {}
): MCPToolProviderInstance {
  // Private state via closure
  const tools = new Map<string, BridgedTool>();

  // Helper function to build tools map
  function buildToolsMap(): void {
    tools.clear();

    const bridgedTools = createToolBridge(manager, options);
    for (const tool of bridgedTools) {
      tools.set(tool.name, tool);
    }
  }

  // Initial build
  buildToolsMap();

  // Return instance object
  return {
    getTools(): AgentTool[] {
      return Array.from(tools.values());
    },

    getToolsFromServer(serverName: string): AgentTool[] {
      return Array.from(tools.values()).filter(
        (tool) => tool.mcpServerName === serverName
      );
    },

    async refresh(): Promise<void> {
      // Refresh tools from all connected servers
      await manager.listAllTools();
      buildToolsMap();
    },

    findTool(name: string): BridgedTool | undefined {
      return tools.get(name);
    },

    getResourceAccessor(): MCPResourceAccessor {
      return createResourceAccessor(manager);
    },

    get count(): number {
      return tools.size;
    },

    getServersWithTools(): string[] {
      const servers = new Set<string>();
      for (const tool of tools.values()) {
        servers.add(tool.mcpServerName);
      }
      return Array.from(servers);
    },
  };
}

