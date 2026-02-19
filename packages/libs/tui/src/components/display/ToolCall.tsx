/**
 * @ai-stack/tui - ToolCall Component
 */

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { useTheme } from '../../theme/provider.js';
import type { ToolCallInfo } from '../../core/types.js';

export interface ToolCallProps extends ToolCallInfo {
  compact?: boolean;
}

export function ToolCall({
  name,
  args,
  status = 'pending',
  result,
  duration,
  compact = false,
}: ToolCallProps) {
  const theme = useTheme();

  // Format arguments
  let argsStr: string;
  try {
    argsStr = JSON.stringify(args, null, 2);
  } catch {
    argsStr = String(args);
  }

  // Truncate args if too long
  const argsLines = argsStr.split('\n');
  const truncatedArgs = argsLines.length > 6
    ? argsLines.slice(0, 5).join('\n') + '\n...'
    : argsStr;

  if (compact) {
    return (
      <Box>
        <Text color={theme.colors.tool}>{theme.icons.tool} {name}</Text>
        {status === 'running' && (
          <>
            <Text> </Text>
            <Spinner type="dots" />
          </>
        )}
        {status === 'completed' && (
          <Text color={theme.colors.success}> {theme.icons.success}</Text>
        )}
        {status === 'error' && (
          <Text color={theme.colors.error}> {theme.icons.error}</Text>
        )}
        {duration && (
          <Text dimColor> ({duration}ms)</Text>
        )}
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={theme.colors.tool}
      paddingX={1}
      marginY={1}
    >
      <Box>
        <Text color={theme.colors.tool}>{theme.icons.tool} Tool</Text>
      </Box>

      <Box marginTop={1}>
        <Text bold>{name}</Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>{truncatedArgs}</Text>
      </Box>

      <Box marginTop={1}>
        {status === 'running' && (
          <Box>
            <Text color={theme.colors.info}><Spinner type="dots" /></Text>
            <Text color={theme.colors.info}> Running...</Text>
          </Box>
        )}
        {status === 'completed' && (
          <Box flexDirection="column">
            <Box>
              <Text color={theme.colors.success}>{theme.icons.success} Completed</Text>
              {duration && <Text dimColor> ({duration}ms)</Text>}
            </Box>
            {result && (
              <Box marginTop={1}>
                <Text dimColor wrap="truncate-end">{result.slice(0, 200)}</Text>
              </Box>
            )}
          </Box>
        )}
        {status === 'error' && (
          <Box flexDirection="column">
            <Text color={theme.colors.error}>{theme.icons.error} Failed</Text>
            {result && (
              <Box marginTop={1}>
                <Text color={theme.colors.error} wrap="truncate-end">{result.slice(0, 200)}</Text>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
