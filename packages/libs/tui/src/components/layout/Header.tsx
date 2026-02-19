/**
 * @ai-stack/tui - Header Component
 */

import React from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../../theme/provider.js';

export interface HeaderProps {
  title: string;
  version?: string;
  model?: string;
  toolCount?: number;
  compact?: boolean;
}

export function Header({
  title,
  version,
  model,
  toolCount,
  compact = false,
}: HeaderProps) {
  const theme = useTheme();

  if (compact) {
    return (
      <Box>
        <Text bold color={theme.colors.agent}>
          {theme.icons.agent} {title}
        </Text>
        {version && (
          <Text dimColor> v{version}</Text>
        )}
        {model && (
          <>
            <Text dimColor> | </Text>
            <Text color={theme.colors.accent}>Model:</Text>
            <Text> {model}</Text>
          </>
        )}
        {toolCount !== undefined && (
          <>
            <Text dimColor> | </Text>
            <Text color={theme.colors.accent}>Tools:</Text>
            <Text> {toolCount}</Text>
          </>
        )}
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.colors.agent}
      paddingX={1}
      marginBottom={1}
    >
      <Box>
        <Text bold color={theme.colors.agent}>
          {theme.icons.agent} {title}
        </Text>
        {version && (
          <Text dimColor> v{version}</Text>
        )}
      </Box>

      <Box marginTop={1} flexDirection="column">
        {model && (
          <Box>
            <Text color={theme.colors.accent}>Model: </Text>
            <Text>{model}</Text>
          </Box>
        )}
        {toolCount !== undefined && (
          <Box>
            <Text color={theme.colors.accent}>Tools: </Text>
            <Text>{toolCount} available</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
