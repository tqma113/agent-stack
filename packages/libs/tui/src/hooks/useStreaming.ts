/**
 * @ai-stack/tui - useStreaming hook
 *
 * Hook for managing streaming output state
 */

import { useState, useCallback } from 'react';
import type { StreamState, ToolCallInfo } from '../core/types.js';

export interface StreamingState {
  state: StreamState;
  buffer: string;
  currentTool: ToolCallInfo | null;
}

export function useStreaming() {
  const [streamingState, setStreamingState] = useState<StreamingState>({
    state: 'idle',
    buffer: '',
    currentTool: null,
  });

  const startThinking = useCallback(() => {
    setStreamingState({
      state: 'thinking',
      buffer: '',
      currentTool: null,
    });
  }, []);

  const startStreaming = useCallback(() => {
    setStreamingState(prev => ({
      ...prev,
      state: 'streaming',
      buffer: '',
    }));
  }, []);

  const addToken = useCallback((token: string) => {
    setStreamingState(prev => ({
      ...prev,
      state: 'streaming',
      buffer: prev.buffer + token,
    }));
  }, []);

  const pauseForTool = useCallback((toolInfo: ToolCallInfo) => {
    setStreamingState(prev => ({
      ...prev,
      state: 'tool',
      currentTool: toolInfo,
    }));
  }, []);

  const resumeAfterTool = useCallback(() => {
    setStreamingState(prev => ({
      ...prev,
      state: 'streaming',
      currentTool: null,
    }));
  }, []);

  const complete = useCallback(() => {
    setStreamingState({
      state: 'idle',
      buffer: '',
      currentTool: null,
    });
  }, []);

  const showError = useCallback((error: string) => {
    setStreamingState({
      state: 'idle',
      buffer: error,
      currentTool: null,
    });
  }, []);

  return {
    ...streamingState,
    startThinking,
    startStreaming,
    addToken,
    pauseForTool,
    resumeAfterTool,
    complete,
    showError,
  };
}
