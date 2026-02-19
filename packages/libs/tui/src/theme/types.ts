/**
 * @ai-stack/tui - Theme Types
 */

/**
 * Theme color values
 */
export interface ThemeColors {
  // Role colors
  user: string;
  agent: string;
  system: string;
  tool: string;

  // Status colors
  success: string;
  error: string;
  warning: string;
  info: string;

  // UI colors
  border: string;
  muted: string;
  highlight: string;
  accent: string;
  background: string;
  foreground: string;

  // Diff colors
  diffAdd: string;
  diffRemove: string;
  diffUnchanged: string;
}

/**
 * Theme icons
 */
export interface ThemeIcons {
  user: string;
  agent: string;
  success: string;
  error: string;
  warning: string;
  info: string;
  tool: string;
  thinking: string;
  arrow: string;
  add: string;
  remove: string;
  unchanged: string;
  undo: string;
  redo: string;
  task: string;
  taskPending: string;
  folder: string;
  file: string;
}

/**
 * Complete theme
 */
export interface Theme {
  name: string;
  colors: ThemeColors;
  icons: ThemeIcons;
}
