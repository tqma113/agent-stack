/**
 * @ai-stack/tui - Terminal utilities
 */

/**
 * Get terminal width with fallback
 */
export function getTerminalWidth(): number {
  try {
    // Use process.stdout.columns for sync access
    return process.stdout.columns || 80;
  } catch {
    return 80;
  }
}

/**
 * Get terminal height with fallback
 */
export function getTerminalHeight(): number {
  try {
    return process.stdout.rows || 24;
  } catch {
    return 24;
  }
}

/**
 * Get terminal size
 */
export function getTerminalSize(): { columns: number; rows: number } {
  try {
    return {
      columns: process.stdout.columns || 80,
      rows: process.stdout.rows || 24,
    };
  } catch {
    return { columns: 80, rows: 24 };
  }
}

/**
 * Check if the terminal supports TTY features
 */
export function isTTY(): boolean {
  return Boolean(process.stdout.isTTY);
}

/**
 * Check if the terminal supports colors
 */
export function supportsColor(): boolean {
  if (!isTTY()) return false;

  // Check various environment variables
  if (process.env.FORCE_COLOR) return true;
  if (process.env.NO_COLOR) return false;
  if (process.env.TERM === 'dumb') return false;
  if (process.env.CI) return true;

  return true;
}

/**
 * Check if the terminal supports Unicode
 */
export function supportsUnicode(): boolean {
  if (process.platform === 'win32') {
    return Boolean(
      process.env.CI ||
      process.env.WT_SESSION ||
      process.env.TERM_PROGRAM === 'vscode' ||
      process.env.TERM === 'xterm-256color'
    );
  }
  return true;
}

/**
 * Hide cursor
 */
export function hideCursor(): void {
  process.stdout.write('\x1b[?25l');
}

/**
 * Show cursor
 */
export function showCursor(): void {
  process.stdout.write('\x1b[?25h');
}

/**
 * Clear screen
 */
export function clearScreen(): void {
  process.stdout.write('\x1b[2J\x1b[H');
}

/**
 * Clear line
 */
export function clearLine(): void {
  process.stdout.write('\x1b[2K\r');
}

/**
 * Move cursor up
 */
export function moveCursorUp(lines = 1): void {
  process.stdout.write(`\x1b[${lines}A`);
}

/**
 * Move cursor down
 */
export function moveCursorDown(lines = 1): void {
  process.stdout.write(`\x1b[${lines}B`);
}
