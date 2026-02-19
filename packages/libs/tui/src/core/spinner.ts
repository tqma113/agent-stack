/**
 * @ai-stack/tui - Spinner utilities
 */

import ora, { type Ora } from 'ora';
import { theme, icons } from './colors.js';

export interface SpinnerOptions {
  text?: string;
  color?: 'green' | 'blue' | 'cyan' | 'yellow' | 'red' | 'magenta';
}

/**
 * Create a thinking spinner (for agent processing)
 */
export function createThinkingSpinner(text = 'Thinking...'): Ora {
  return ora({
    text: theme.muted(text),
    spinner: 'dots',
    color: 'cyan',
    discardStdin: false,
  });
}

/**
 * Create a loading spinner (for initialization)
 */
export function createLoadingSpinner(text = 'Loading...'): Ora {
  return ora({
    text,
    spinner: 'dots',
    color: 'blue',
    discardStdin: false,
  });
}

/**
 * Create a tool execution spinner
 */
export function createToolSpinner(toolName: string): Ora {
  return ora({
    text: `${theme.tool(icons.tool)} Executing ${theme.highlight(toolName)}...`,
    spinner: 'dots',
    color: 'magenta',
    discardStdin: false,
  });
}

/**
 * Create a custom spinner
 */
export function createSpinner(options: SpinnerOptions = {}): Ora {
  return ora({
    text: options.text || 'Loading...',
    spinner: 'dots',
    color: options.color || 'cyan',
    discardStdin: false,
  });
}

/**
 * Legacy spinner for classic mode (no external dependencies)
 */
export function createLegacySpinner(text: string) {
  const frames = ['\u280b', '\u2819', '\u2839', '\u2838', '\u283c', '\u2834', '\u2826', '\u2827', '\u2807', '\u280f'];
  let i = 0;
  let interval: NodeJS.Timeout | null = null;

  return {
    start() {
      process.stdout.write('\x1b[?25l'); // Hide cursor
      interval = setInterval(() => {
        process.stdout.write(`\r\x1b[36m${frames[i]}\x1b[0m ${text}`);
        i = (i + 1) % frames.length;
      }, 80);
      return this;
    },
    stop() {
      if (interval) {
        clearInterval(interval);
        process.stdout.write('\r\x1b[K'); // Clear line
        process.stdout.write('\x1b[?25h'); // Show cursor
      }
      return this;
    },
    succeed(msg: string) {
      this.stop();
      console.log(`\x1b[32m\u2714\x1b[0m ${msg}`);
      return this;
    },
    fail(msg: string) {
      this.stop();
      console.log(`\x1b[31m\u2716\x1b[0m ${msg}`);
      return this;
    },
    info(msg: string) {
      this.stop();
      console.log(`\x1b[34m\u2139\x1b[0m ${msg}`);
      return this;
    },
  };
}
