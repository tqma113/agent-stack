/**
 * @ai-stack/tui - Panel Component
 */

import React, { type ReactNode } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../../theme/provider.js';

export interface PanelProps {
  title?: string;
  children: ReactNode;
  borderColor?: string;
  width?: number | string;
  padding?: number;
}

export function Panel({
  title,
  children,
  borderColor,
  width,
  padding = 1,
}: PanelProps) {
  const theme = useTheme();
  const color = borderColor || theme.colors.border;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={color}
      width={width}
      paddingX={padding}
    >
      {title && (
        <Box marginBottom={1}>
          <Text bold color={color}>{title}</Text>
        </Box>
      )}
      {children}
    </Box>
  );
}
