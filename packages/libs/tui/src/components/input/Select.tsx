/**
 * @ai-stack/tui - Select Component
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../../theme/provider.js';

export interface SelectOption<T = string> {
  label: string;
  value: T;
  description?: string;
}

export interface SelectProps<T = string> {
  options: SelectOption<T>[];
  onSelect?: (value: T) => void;
  onCancel?: () => void;
  title?: string;
  initialIndex?: number;
}

export function Select<T = string>({
  options,
  onSelect,
  onCancel,
  title,
  initialIndex = 0,
}: SelectProps<T>) {
  const theme = useTheme();
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : options.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => (prev < options.length - 1 ? prev + 1 : 0));
    } else if (key.return) {
      onSelect?.(options[selectedIndex].value);
    } else if (key.escape) {
      onCancel?.();
    }
  });

  return (
    <Box flexDirection="column">
      {title && (
        <Box marginBottom={1}>
          <Text bold color={theme.colors.accent}>{title}</Text>
        </Box>
      )}

      {options.map((option, index) => {
        const isSelected = index === selectedIndex;
        return (
          <Box key={index} flexDirection="column">
            <Box>
              <Text color={isSelected ? theme.colors.accent : undefined}>
                {isSelected ? theme.icons.arrow : ' '}{' '}
              </Text>
              <Text
                bold={isSelected}
                color={isSelected ? theme.colors.accent : undefined}
              >
                {option.label}
              </Text>
            </Box>
            {option.description && isSelected && (
              <Box marginLeft={3}>
                <Text dimColor>{option.description}</Text>
              </Box>
            )}
          </Box>
        );
      })}

      <Box marginTop={1}>
        <Text dimColor>Use arrow keys to navigate, Enter to select, Esc to cancel</Text>
      </Box>
    </Box>
  );
}
