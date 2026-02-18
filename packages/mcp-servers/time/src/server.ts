/**
 * MCP Server implementation for time
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { ServerConfig, GetCurrentTimeResult, ConvertTimeResult } from './types.js';
import { GetCurrentTimeInputSchema, ConvertTimeInputSchema, TimeError } from './types.js';
import {
  getSystemTimezone,
  getTimeInfo,
  parseTimeInTimezone,
  getTimeDifference,
} from './timezone.js';

const TOOL_GET_CURRENT_TIME = 'get_current_time';
const TOOL_CONVERT_TIME = 'convert_time';

/**
 * Create and configure the MCP server
 */
export function createServer(config: ServerConfig = {}) {
  const serverName = config.name || 'agent-stack-mcp-time';
  const serverVersion = config.version || '0.0.1';
  const localTimezone = config.localTimezone || getSystemTimezone();

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
          name: TOOL_GET_CURRENT_TIME,
          description: `Get the current time in a specific timezone or the system timezone.

Returns the current datetime, timezone name, and whether DST is in effect.

System timezone: ${localTimezone}`,
          inputSchema: {
            type: 'object',
            properties: {
              timezone: {
                type: 'string',
                description: `IANA timezone name (e.g., "America/New_York", "Europe/London", "Asia/Tokyo"). If not provided, uses system timezone (${localTimezone})`,
              },
            },
            required: [],
          },
        },
        {
          name: TOOL_CONVERT_TIME,
          description: `Convert a time from one timezone to another.

Takes a time in 24-hour format (HH:MM) and converts it between two timezones.
Returns both source and target time info, plus the time difference.`,
          inputSchema: {
            type: 'object',
            properties: {
              source_timezone: {
                type: 'string',
                description: 'Source IANA timezone name (e.g., "America/New_York")',
              },
              time: {
                type: 'string',
                description: 'Time in 24-hour format (HH:MM), e.g., "14:30"',
              },
              target_timezone: {
                type: 'string',
                description: 'Target IANA timezone name (e.g., "Asia/Tokyo")',
              },
            },
            required: ['source_timezone', 'time', 'target_timezone'],
          },
        },
      ],
    };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;

    try {
      if (toolName === TOOL_GET_CURRENT_TIME) {
        return handleGetCurrentTime(request.params.arguments, localTimezone);
      }

      if (toolName === TOOL_CONVERT_TIME) {
        return handleConvertTime(request.params.arguments);
      }

      return {
        content: [
          {
            type: 'text',
            text: `Unknown tool: ${toolName}`,
          },
        ],
        isError: true,
      };
    } catch (error) {
      let errorMessage: string;

      if (error instanceof TimeError) {
        errorMessage = `Time error [${error.code}]: ${error.message}`;
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
 * Handle get_current_time tool
 */
function handleGetCurrentTime(args: unknown, localTimezone: string) {
  const parseResult = GetCurrentTimeInputSchema.safeParse(args);
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

  const timezone = parseResult.data.timezone || localTimezone;
  const now = new Date();
  const result: GetCurrentTimeResult = getTimeInfo(now, timezone);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

/**
 * Handle convert_time tool
 */
function handleConvertTime(args: unknown) {
  const parseResult = ConvertTimeInputSchema.safeParse(args);
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

  const { source_timezone, time, target_timezone } = parseResult.data;

  // Parse the time in source timezone
  const date = parseTimeInTimezone(time, source_timezone);

  // Get time info for both timezones
  const sourceInfo = getTimeInfo(date, source_timezone);
  const targetInfo = getTimeInfo(date, target_timezone);
  const timeDiff = getTimeDifference(source_timezone, target_timezone, date);

  const result: ConvertTimeResult = {
    source: sourceInfo,
    target: targetInfo,
    time_difference: timeDiff,
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
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
