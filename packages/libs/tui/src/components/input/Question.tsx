/**
 * @ai-stack/tui - Question Component
 *
 * Displays a question from the agent and allows user to respond
 * with either text input or selection from options.
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../../theme/provider.js';

export interface QuestionOption {
  label: string;
  value: string;
  description?: string;
}

export interface QuestionProps {
  /** The question text to display */
  question: string;
  /** Optional choices for the user (if provided, shows selection mode) */
  options?: QuestionOption[];
  /** Called when user submits an answer */
  onAnswer?: (answer: string) => void;
  /** Called when user cancels */
  onCancel?: () => void;
  /** Placeholder text for text input mode */
  placeholder?: string;
}

export function Question({
  question,
  options,
  onAnswer,
  onCancel,
  placeholder = 'Type your answer...',
}: QuestionProps) {
  const theme = useTheme();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [textInput, setTextInput] = useState('');

  const isSelectionMode = options && options.length > 0;

  useInput((input, key) => {
    if (key.escape) {
      onCancel?.();
      return;
    }

    if (isSelectionMode) {
      // Selection mode
      if (key.upArrow) {
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : options!.length - 1));
      } else if (key.downArrow) {
        setSelectedIndex(prev => (prev < options!.length - 1 ? prev + 1 : 0));
      } else if (key.return) {
        onAnswer?.(options![selectedIndex].value);
      }
    } else {
      // Text input mode
      if (key.return) {
        if (textInput.trim()) {
          onAnswer?.(textInput.trim());
        }
      } else if (key.backspace || key.delete) {
        setTextInput(prev => prev.slice(0, -1));
      } else if (!key.ctrl && !key.meta && input) {
        setTextInput(prev => prev + input);
      }
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.colors.info}
      paddingX={1}
      paddingY={1}
    >
      {/* Question header */}
      <Box marginBottom={1}>
        <Text color={theme.colors.info}>{theme.icons.question} </Text>
        <Text bold>{question}</Text>
      </Box>

      {isSelectionMode ? (
        // Selection mode UI
        <Box flexDirection="column">
          {options!.map((option, index) => {
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
            <Text dimColor>Arrow keys to select, Enter to confirm, Esc to cancel</Text>
          </Box>
        </Box>
      ) : (
        // Text input mode UI
        <Box flexDirection="column">
          <Box
            borderStyle="single"
            borderColor={theme.colors.border}
            paddingX={1}
          >
            <Text>
              {textInput || <Text dimColor>{placeholder}</Text>}
            </Text>
            <Text inverse> </Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Type your answer, Enter to submit, Esc to cancel</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
