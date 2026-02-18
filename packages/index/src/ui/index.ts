/**
 * UI module exports for Agent Stack CLI
 */

// Types
export * from './types.js';

// Theme and colors
export { theme, icons, borders, legacyColors } from './colors.js';

// Spinner utilities
export {
  createThinkingSpinner,
  createLoadingSpinner,
  createToolSpinner,
  createSpinner,
  createLegacySpinner,
} from './spinner.js';

// Box rendering
export {
  getTerminalWidth,
  renderMessage,
  renderToolCall,
  renderStatusBox,
  renderToolCallInline,
} from './box.js';

// Layout components
export {
  renderHeader,
  renderHeaderLine,
  renderFooter,
  renderWelcome,
  renderDivider,
  renderPrompt,
  renderAgentPrefix,
} from './layout.js';

// Stream renderer
export { StreamRenderer, createStreamRenderer } from './stream.js';
