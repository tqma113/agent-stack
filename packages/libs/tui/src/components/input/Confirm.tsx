/**
 * @ai-stack/tui - Confirm Component
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../../theme/provider.js';

export interface ConfirmProps {
  message: string;
  onConfirm?: () => void;
  onReject?: () => void;
  defaultValue?: boolean;
}

export function Confirm({
  message,
  onConfirm,
  onReject,
  defaultValue = false,
}: ConfirmProps) {
  const theme = useTheme();
  const [selected, setSelected] = useState(defaultValue);

  useInput((input, key) => {
    if (input === 'y' || input === 'Y') {
      onConfirm?.();
    } else if (input === 'n' || input === 'N') {
      onReject?.();
    } else if (key.return) {
      if (selected) {
        onConfirm?.();
      } else {
        onReject?.();
      }
    } else if (key.escape) {
      onReject?.();
    } else if (key.leftArrow || key.rightArrow || key.tab) {
      setSelected(!selected);
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.colors.warning}
      paddingX={1}
      paddingY={1}
    >
      <Box marginBottom={1}>
        <Text color={theme.colors.warning}>{theme.icons.warning} </Text>
        <Text>{message}</Text>
      </Box>

      <Box gap={2}>
        <Box>
          <Text
            color={selected ? theme.colors.success : undefined}
            bold={selected}
            inverse={selected}
          >
            {' '}[Y] Yes{' '}
          </Text>
        </Box>
        <Box>
          <Text
            color={!selected ? theme.colors.error : undefined}
            bold={!selected}
            inverse={!selected}
          >
            {' '}[N] No{' '}
          </Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Press Y/N or Enter to confirm, Esc to cancel</Text>
      </Box>
    </Box>
  );
}
