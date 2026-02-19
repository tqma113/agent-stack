/**
 * @ai-stack/tui - Divider Component
 */

import React from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../../theme/provider.js';

export interface DividerProps {
  width?: number;
  char?: string;
  title?: string;
}

export function Divider({ width = 60, char = '\u2500', title }: DividerProps) {
  const theme = useTheme();

  if (title) {
    const sideWidth = Math.max(2, Math.floor((width - title.length - 2) / 2));
    return (
      <Box>
        <Text dimColor>{char.repeat(sideWidth)} </Text>
        <Text color={theme.colors.accent}>{title}</Text>
        <Text dimColor> {char.repeat(sideWidth)}</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text dimColor>{char.repeat(width)}</Text>
    </Box>
  );
}
