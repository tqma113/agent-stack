/**
 * @ai-stack/tui - Core module exports
 *
 * Non-React utilities for TUI rendering
 */

// Types
export * from './types.js';

// Theme and colors
export { theme, icons, borders, legacyColors } from './colors.js';

// Terminal utilities
export {
  getTerminalWidth,
  getTerminalHeight,
  getTerminalSize,
  isTTY,
  supportsColor,
  supportsUnicode,
  hideCursor,
  showCursor,
  clearScreen,
  clearLine,
  moveCursorUp,
  moveCursorDown,
} from './terminal.js';

// Spinner utilities
export {
  createThinkingSpinner,
  createLoadingSpinner,
  createToolSpinner,
  createSpinner,
  createLegacySpinner,
  type SpinnerOptions,
} from './spinner.js';

// Diff utilities
export {
  computeDiff,
  applyPatch,
  getDiffSummary,
  wordDiff,
  lineDiff,
  formatUnifiedDiff,
} from './diff.js';

// Render utilities
export {
  renderMessage,
  renderStatusBox,
  renderToolCall,
  renderToolCallInline,
  renderHeader,
  renderHeaderLine,
  renderFooter,
  renderWelcome,
  renderDivider,
  renderPrompt,
  renderAgentPrefix,
} from './render.js';

// Stream renderer
export { StreamRenderer, createStreamRenderer } from './stream.js';
