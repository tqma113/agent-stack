/**
 * @ai-stack/tui - Badge Component
 */

import React from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../../theme/provider.js';

export type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'default';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

export function Badge({ label, variant = 'default' }: BadgeProps) {
  const theme = useTheme();

  const getColor = () => {
    switch (variant) {
      case 'success':
        return theme.colors.success;
      case 'error':
        return theme.colors.error;
      case 'warning':
        return theme.colors.warning;
      case 'info':
        return theme.colors.info;
      default:
        return theme.colors.muted;
    }
  };

  const getIcon = () => {
    switch (variant) {
      case 'success':
        return theme.icons.success;
      case 'error':
        return theme.icons.error;
      case 'warning':
        return theme.icons.warning;
      case 'info':
        return theme.icons.info;
      default:
        return '';
    }
  };

  const color = getColor();
  const icon = getIcon();

  return (
    <Box>
      <Text color={color}>
        {icon && `${icon} `}
        [{label}]
      </Text>
    </Box>
  );
}
