/**
 * @ai-stack/tui - Terminal UI for AI Stack
 *
 * This package provides a unified TUI library for AI Stack agents.
 * It combines Ink (React-based TUI) components for rich interactive interfaces
 * with direct stdout rendering for streaming performance.
 */

// Core module (non-React utilities)
// Export everything except Message type (conflicts with Message component)
export {
  // Types
  type Role,
  type ToolCallStatus,
  type ToolCallInfo,
  type HeaderInfo,
  type FooterInfo,
  type StreamState,
  type RenderOptions,
  type DiffLineType,
  type DiffLine,
  type DiffResult,
  type TaskStatus,
  type TaskItem,
  type FileChangeType,
  type FileChange,
  type ConfirmCallback,
  // Colors
  theme,
  icons,
  borders,
  legacyColors,
  // Terminal
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
  // Spinner
  createThinkingSpinner,
  createLoadingSpinner,
  createToolSpinner,
  createSpinner,
  createLegacySpinner,
  type SpinnerOptions,
  // Diff
  computeDiff,
  applyPatch,
  getDiffSummary,
  wordDiff,
  lineDiff,
  formatUnifiedDiff,
  // Render
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
  // Stream
  StreamRenderer,
  createStreamRenderer,
} from './core/index.js';

// Export Message type from core with alias to avoid confusion
export type { Message as MessageData } from './core/index.js';

// Theme
export { ThemeProvider, useTheme } from './theme/provider.js';
export { defaultTheme } from './theme/default.js';
export type { Theme, ThemeColors, ThemeIcons } from './theme/types.js';

// Components (React/Ink)
export * from './components/index.js';

// Hooks
export * from './hooks/index.js';

// Adapters (environment detection and auto-switching)
export {
  // Detection
  detectEnvironment,
  setRenderMode,
  type RenderMode,
  type EnvironmentInfo,
  // TTY adapter
  render,
  unmount,
  ttyShowConfirm,
  ttyShowSelect,
  ttyShowDiffView,
  ttyShowQuestion,
  // Classic adapter
  classicShowConfirm,
  classicShowSelect,
  classicShowDiffView,
  classicShowQuestion,
  readLine,
  createInteractiveLoop,
  // Auto-detecting functions
  showConfirm,
  showSelect,
  showDiffView,
  showQuestion,
  type QuestionOption,
} from './adapters/index.js';
