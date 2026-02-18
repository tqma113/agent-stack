/**
 * Stream output management for CLI
 */

import type { Ora } from 'ora';
import { createThinkingSpinner, createToolSpinner } from './spinner.js';
import { renderToolCall, renderToolCallInline, getTerminalWidth } from './box.js';
import { theme, icons } from './colors.js';
import type { StreamState, ToolCallInfo } from './types.js';

/**
 * StreamRenderer manages the streaming output display
 */
export class StreamRenderer {
  private state: StreamState = 'idle';
  private spinner: Ora | null = null;
  private buffer = '';
  private currentLine = '';
  private lineCount = 0;
  private compact: boolean;

  constructor(options: { compact?: boolean } = {}) {
    this.compact = options.compact ?? false;
  }

  /**
   * Start thinking state (show spinner)
   */
  startThinking(): void {
    if (this.state !== 'idle') {
      this.complete();
    }
    this.state = 'thinking';
    this.spinner = createThinkingSpinner('Thinking...');
    this.spinner.start();
  }

  /**
   * Transition from thinking to streaming
   */
  startStreaming(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }

    this.state = 'streaming';
    this.buffer = '';
    this.currentLine = '';
    this.lineCount = 0;

    // Print agent prefix
    process.stdout.write(theme.agent(`\n${icons.agent} Agent: `));
  }

  /**
   * Add a token to the stream output
   */
  addToken(token: string): void {
    if (this.state === 'thinking') {
      this.startStreaming();
    }

    if (this.state !== 'streaming') {
      return;
    }

    this.buffer += token;
    process.stdout.write(token);

    // Track newlines
    if (token.includes('\n')) {
      this.lineCount += (token.match(/\n/g) || []).length;
      this.currentLine = token.split('\n').pop() || '';
    } else {
      this.currentLine += token;
    }
  }

  /**
   * Pause streaming for tool call
   */
  pauseForTool(toolInfo: ToolCallInfo): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }

    // Ensure we're on a new line
    if (this.currentLine.length > 0) {
      process.stdout.write('\n');
      this.currentLine = '';
    }

    this.state = 'tool';

    if (this.compact) {
      // Compact mode: inline display
      console.log(renderToolCallInline(toolInfo.name, 'start'));
    } else {
      // Full mode: render tool box
      console.log('\n' + renderToolCall({
        ...toolInfo,
        status: 'running',
      }));
    }
  }

  /**
   * Resume after tool call completes
   */
  resumeAfterTool(toolInfo: ToolCallInfo): void {
    if (this.compact) {
      // In compact mode, update the line with completion status
      process.stdout.write('\x1b[1A\x1b[K'); // Move up and clear
      console.log(renderToolCallInline(toolInfo.name, 'end'));
    } else {
      // Full mode: show completed tool box
      console.log(renderToolCall({
        ...toolInfo,
        status: toolInfo.result?.startsWith('Error') ? 'error' : 'completed',
      }));
    }

    this.state = 'streaming';
  }

  /**
   * Complete the stream output
   */
  complete(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }

    if (this.state === 'streaming' && this.buffer.length > 0) {
      // Ensure we end with a newline
      if (!this.buffer.endsWith('\n')) {
        process.stdout.write('\n');
      }
    }

    this.state = 'idle';
    this.buffer = '';
    this.currentLine = '';
    this.lineCount = 0;
  }

  /**
   * Show an error during streaming
   */
  showError(error: string): void {
    if (this.spinner) {
      this.spinner.fail(error);
      this.spinner = null;
    } else {
      console.error(theme.error(`\n${icons.error} ${error}`));
    }
    this.state = 'idle';
  }

  /**
   * Get current state
   */
  getState(): StreamState {
    return this.state;
  }
}

/**
 * Create a stream renderer instance
 */
export function createStreamRenderer(options: { compact?: boolean } = {}): StreamRenderer {
  return new StreamRenderer(options);
}
