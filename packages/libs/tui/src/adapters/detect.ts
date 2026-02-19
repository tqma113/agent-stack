/**
 * @ai-stack/tui - Environment Detection
 */

import { isTTY, supportsColor, supportsUnicode } from '../core/terminal.js';

export type RenderMode = 'tty' | 'classic';

export interface EnvironmentInfo {
  isTTY: boolean;
  supportsColor: boolean;
  supportsUnicode: boolean;
  mode: RenderMode;
}

/**
 * Detect the rendering environment
 */
export function detectEnvironment(): EnvironmentInfo {
  const tty = isTTY();
  const color = supportsColor();
  const unicode = supportsUnicode();

  // Use classic mode if not a TTY or if forced
  const mode: RenderMode = !tty || process.env.TUI_MODE === 'classic' ? 'classic' : 'tty';

  return {
    isTTY: tty,
    supportsColor: color,
    supportsUnicode: unicode,
    mode,
  };
}

/**
 * Force a specific rendering mode
 */
export function setRenderMode(mode: RenderMode): void {
  if (mode === 'classic') {
    process.env.TUI_MODE = 'classic';
  } else {
    delete process.env.TUI_MODE;
  }
}
