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
import type { MCPClientManager } from './client';
import {
  generateToolName,
  parseToolResultContent,
  formatErrorResult,
} from './helpers';

/**
 * Create Agent-compatible tools from all MCP servers
 */
export function createToolBridge(
  manager: MCPClientManager,
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
  manager: MCPClientManager,
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
  manager: MCPClientManager
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
 * MCPToolProvider class for easier integration with Agent
 */
export class MCPToolProvider {
  private manager: MCPClientManager;
  private options: MCPToolBridgeOptions;
  private tools: Map<string, BridgedTool> = new Map();

  constructor(manager: MCPClientManager, options: MCPToolBridgeOptions = {}) {
    this.manager = manager;
    this.options = options;
    this.buildToolsMap();
  }

  /**
   * Get all bridged tools as Agent Tool array
   */
  getTools(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools from a specific server
   */
  getToolsFromServer(serverName: string): AgentTool[] {
    return Array.from(this.tools.values()).filter(
      (tool) => tool.mcpServerName === serverName
    );
  }

  /**
   * Refresh tools from all servers
   */
  async refresh(): Promise<void> {
    // Refresh tools from all connected servers
    await this.manager.listAllTools();
    this.buildToolsMap();
  }

  /**
   * Find tool by name
   */
  findTool(name: string): BridgedTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get resource accessor
   */
  getResourceAccessor(): MCPResourceAccessor {
    return createResourceAccessor(this.manager);
  }

  /**
   * Get tool count
   */
  get count(): number {
    return this.tools.size;
  }

  /**
   * Get server names that have tools
   */
  getServersWithTools(): string[] {
    const servers = new Set<string>();
    for (const tool of this.tools.values()) {
      servers.add(tool.mcpServerName);
    }
    return Array.from(servers);
  }

  /**
   * Build tools map from manager connections
   */
  private buildToolsMap(): void {
    this.tools.clear();

    const bridgedTools = createToolBridge(this.manager, this.options);
    for (const tool of bridgedTools) {
      this.tools.set(tool.name, tool);
    }
  }
}
