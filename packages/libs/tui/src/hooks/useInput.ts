/**
 * @ai-stack/tui - useInput hook
 *
 * Enhanced input handling hook
 */

import { useCallback, useEffect, useState } from 'react';
import { useInput as useInkInput, useApp } from 'ink';

export interface InputState {
  value: string;
  cursorPosition: number;
}

export interface UseInputOptions {
  initialValue?: string;
  history?: string[];
  onSubmit?: (value: string) => void;
  onCancel?: () => void;
}

export function useInputState({
  initialValue = '',
  history = [],
  onSubmit,
  onCancel,
}: UseInputOptions = {}) {
  const [value, setValue] = useState(initialValue);
  const [cursorPosition, setCursorPosition] = useState(initialValue.length);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [savedValue, setSavedValue] = useState('');

  const reset = useCallback(() => {
    setValue('');
    setCursorPosition(0);
    setHistoryIndex(-1);
    setSavedValue('');
  }, []);

  const handleInput = useCallback((input: string, key: {
    return: boolean;
    escape: boolean;
    backspace: boolean;
    delete: boolean;
    leftArrow: boolean;
    rightArrow: boolean;
    upArrow: boolean;
    downArrow: boolean;
    ctrl: boolean;
    meta: boolean;
    tab: boolean;
  }) => {
    if (key.return) {
      if (value.trim()) {
        onSubmit?.(value);
        reset();
      }
      return;
    }

    if (key.escape) {
      onCancel?.();
      return;
    }

    if (key.backspace || key.delete) {
      if (cursorPosition > 0) {
        setValue(prev => prev.slice(0, cursorPosition - 1) + prev.slice(cursorPosition));
        setCursorPosition(prev => prev - 1);
      }
      return;
    }

    if (key.leftArrow) {
      setCursorPosition(prev => Math.max(0, prev - 1));
      return;
    }

    if (key.rightArrow) {
      setCursorPosition(prev => Math.min(value.length, prev + 1));
      return;
    }

    if (key.upArrow) {
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
      return;
    }

    if (key.downArrow) {
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
      return;
    }

    if (key.ctrl && input === 'a') {
      setCursorPosition(0);
      return;
    }

    if (key.ctrl && input === 'e') {
      setCursorPosition(value.length);
      return;
    }

    if (key.ctrl && input === 'u') {
      setValue('');
      setCursorPosition(0);
      return;
    }

    if (key.ctrl && input === 'k') {
      setValue(prev => prev.slice(0, cursorPosition));
      return;
    }

    if (!key.ctrl && !key.meta && input) {
      setValue(prev => prev.slice(0, cursorPosition) + input + prev.slice(cursorPosition));
      setCursorPosition(prev => prev + input.length);
    }
  }, [value, cursorPosition, history, historyIndex, savedValue, onSubmit, onCancel, reset]);

  return {
    value,
    cursorPosition,
    setValue,
    setCursorPosition,
    handleInput,
    reset,
  };
}
