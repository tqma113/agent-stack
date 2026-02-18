/**
 * MCP Server implementation for fetch
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { ServerConfig } from './types.js';
import { FetchInputSchema, FetchError } from './types.js';
import { fetchUrl } from './fetcher.js';

const TOOL_NAME = 'fetch';

/**
 * Create and configure the MCP server
 */
export function createServer(config: ServerConfig = {}) {
  const serverName = config.name || 'ai-stack-mcp-fetch';
  const serverVersion = config.version || '0.0.1';

  const server = new Server(
    {
      name: serverName,
      version: serverVersion,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: TOOL_NAME,
          description: `Fetches content from a URL and converts HTML to Markdown.

Features:
- Automatic HTML to Markdown conversion
- CSS selector support for extracting specific content
- Configurable timeout and max length
- Domain allow/block lists
- Handles redirects automatically

Returns the page title, converted content, and metadata.`,
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to fetch (must be http or https)',
              },
              maxLength: {
                type: 'number',
                description: 'Maximum content length in characters (default: 50000)',
              },
              timeout: {
                type: 'number',
                description: 'Request timeout in milliseconds (default: 30000)',
              },
              userAgent: {
                type: 'string',
                description: 'Custom User-Agent header',
              },
              selector: {
                type: 'string',
                description: 'CSS selector to extract specific content (e.g., "article", "main", ".content")',
              },
              raw: {
                type: 'boolean',
                description: 'Return raw HTML instead of Markdown (default: false)',
              },
            },
            required: ['url'],
          },
        },
      ],
    };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== TOOL_NAME) {
      return {
        content: [
          {
            type: 'text',
            text: `Unknown tool: ${request.params.name}`,
          },
        ],
        isError: true,
      };
    }

    try {
      // Validate input
      const parseResult = FetchInputSchema.safeParse(request.params.arguments);
      if (!parseResult.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Invalid input: ${parseResult.error.message}`,
            },
          ],
          isError: true,
        };
      }

      // Fetch the URL
      const result = await fetchUrl(parseResult.data, config);

      // Format output
      const output = [
        `# ${result.title}`,
        '',
        `**URL:** ${result.finalUrl}`,
        `**Status:** ${result.statusCode}`,
        `**Content-Type:** ${result.contentType}`,
        `**Length:** ${result.contentLength} chars${result.truncated ? ' (truncated)' : ''}`,
        '',
        '---',
        '',
        result.content,
      ].join('\n');

      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      let errorMessage: string;

      if (error instanceof FetchError) {
        errorMessage = `Fetch error [${error.code}]: ${error.message}`;
        if (error.statusCode) {
          errorMessage += ` (HTTP ${error.statusCode})`;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else {
        errorMessage = String(error);
      }

      return {
        content: [
          {
            type: 'text',
            text: errorMessage,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Run the server with stdio transport
 */
export async function runServer(config: ServerConfig = {}): Promise<void> {
  const server = createServer(config);
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.close();
    process.exit(0);
  });
}
