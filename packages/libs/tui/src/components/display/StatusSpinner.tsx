/**
 * @ai-stack/tui - StatusSpinner Component
 */

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { useTheme } from '../../theme/provider.js';

export type SpinnerStatus = 'loading' | 'thinking' | 'processing' | 'success' | 'error';

export interface StatusSpinnerProps {
  status: SpinnerStatus;
  text?: string;
}

export function StatusSpinner({ status, text }: StatusSpinnerProps) {
  const theme = useTheme();

  const getDefaultText = () => {
    switch (status) {
      case 'loading':
        return 'Loading...';
      case 'thinking':
        return 'Thinking...';
      case 'processing':
        return 'Processing...';
      case 'success':
        return 'Done';
      case 'error':
        return 'Error';
    }
  };

  const displayText = text || getDefaultText();

  if (status === 'success') {
    return (
      <Box>
        <Text color={theme.colors.success}>{theme.icons.success} </Text>
        <Text>{displayText}</Text>
      </Box>
    );
  }

  if (status === 'error') {
    return (
      <Box>
        <Text color={theme.colors.error}>{theme.icons.error} </Text>
        <Text color={theme.colors.error}>{displayText}</Text>
      </Box>
    );
  }

  const spinnerColor = status === 'thinking' ? theme.colors.agent : theme.colors.info;

  return (
    <Box>
      <Text color={spinnerColor}>
        <Spinner type="dots" />
      </Text>
      <Text> {displayText}</Text>
    </Box>
  );
}
