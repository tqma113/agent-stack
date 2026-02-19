/**
 * @ai-stack/tui - TextInput Component
 *
 * Enhanced text input with history support
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../../theme/provider.js';

export interface TextInputProps {
  prompt?: string;
  placeholder?: string;
  history?: string[];
  onSubmit?: (value: string) => void;
  onCancel?: () => void;
  mask?: string;
}

export function TextInput({
  prompt = '> ',
  placeholder = '',
  history = [],
  onSubmit,
  onCancel,
  mask,
}: TextInputProps) {
  const theme = useTheme();
  const [value, setValue] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [savedValue, setSavedValue] = useState('');

  const displayValue = mask ? mask.repeat(value.length) : value;

  useInput((input, key) => {
    if (key.return) {
      if (value.trim()) {
        onSubmit?.(value);
        setValue('');
        setCursorPosition(0);
        setHistoryIndex(-1);
      }
    } else if (key.escape) {
      onCancel?.();
    } else if (key.backspace || key.delete) {
      if (cursorPosition > 0) {
        setValue(prev => prev.slice(0, cursorPosition - 1) + prev.slice(cursorPosition));
        setCursorPosition(prev => prev - 1);
      }
    } else if (key.leftArrow) {
      if (cursorPosition > 0) {
        setCursorPosition(prev => prev - 1);
      }
    } else if (key.rightArrow) {
      if (cursorPosition < value.length) {
        setCursorPosition(prev => prev + 1);
      }
    } else if (key.upArrow) {
      // Navigate history
      if (history.length > 0) {
        if (historyIndex === -1) {
          setSavedValue(value);
        }
        const newIndex = Math.min(historyIndex + 1, history.length - 1);
        setHistoryIndex(newIndex);
        const historyValue = history[history.length - 1 - newIndex];
        setValue(historyValue);
        setCursorPosition(historyValue.length);
      }
    } else if (key.downArrow) {
      // Navigate history
      if (historyIndex > -1) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        if (newIndex === -1) {
          setValue(savedValue);
          setCursorPosition(savedValue.length);
        } else {
          const historyValue = history[history.length - 1 - newIndex];
          setValue(historyValue);
          setCursorPosition(historyValue.length);
        }
      }
    } else if (key.ctrl && input === 'a') {
      setCursorPosition(0);
    } else if (key.ctrl && input === 'e') {
      setCursorPosition(value.length);
    } else if (key.ctrl && input === 'u') {
      setValue('');
      setCursorPosition(0);
    } else if (key.ctrl && input === 'k') {
      setValue(prev => prev.slice(0, cursorPosition));
    } else if (!key.ctrl && !key.meta && input) {
      setValue(prev => prev.slice(0, cursorPosition) + input + prev.slice(cursorPosition));
      setCursorPosition(prev => prev + input.length);
    }
  });

  // Build display with cursor
  const beforeCursor = displayValue.slice(0, cursorPosition);
  const atCursor = displayValue[cursorPosition] || ' ';
  const afterCursor = displayValue.slice(cursorPosition + 1);

  const showPlaceholder = value.length === 0 && placeholder;

  return (
    <Box>
      <Text color={theme.colors.user}>{prompt}</Text>
      {showPlaceholder ? (
        <Text dimColor>{placeholder}</Text>
      ) : (
        <>
          <Text>{beforeCursor}</Text>
          <Text inverse>{atCursor}</Text>
          <Text>{afterCursor}</Text>
        </>
      )}
    </Box>
  );
}
