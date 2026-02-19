/**
 * @ai-stack/tui - Message Component
 */

import React from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../../theme/provider.js';
import type { Role } from '../../core/types.js';

export interface MessageProps {
  role: Role;
  content: string;
  timestamp?: Date;
  showTimestamp?: boolean;
}

export function Message({
  role,
  content,
  timestamp,
  showTimestamp = false,
}: MessageProps) {
  const theme = useTheme();

  const getRoleColor = () => {
    switch (role) {
      case 'user':
        return theme.colors.user;
      case 'agent':
        return theme.colors.agent;
      case 'system':
        return theme.colors.system;
      case 'tool':
        return theme.colors.tool;
      default:
        return theme.colors.foreground;
    }
  };

  const getRoleLabel = () => {
    switch (role) {
      case 'user':
        return `${theme.icons.user} You`;
      case 'agent':
        return `${theme.icons.agent} Agent`;
      case 'system':
        return `${theme.icons.info} System`;
      case 'tool':
        return `${theme.icons.tool} Tool`;
      default:
        return role;
    }
  };

  const color = getRoleColor();

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={color}
      paddingX={1}
      marginY={1}
    >
      <Box justifyContent="space-between">
        <Text bold color={color}>{getRoleLabel()}</Text>
        {showTimestamp && timestamp && (
          <Text dimColor>
            {timestamp.toLocaleTimeString()}
          </Text>
        )}
      </Box>
      <Box marginTop={1}>
        <Text wrap="wrap">{content}</Text>
      </Box>
    </Box>
  );
}
