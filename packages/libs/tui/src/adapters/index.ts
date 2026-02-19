/**
 * @ai-stack/tui - Adapters
 */

export { detectEnvironment, setRenderMode, type RenderMode, type EnvironmentInfo } from './detect.js';

// TTY adapter
export {
  render,
  unmount,
  showConfirm as ttyShowConfirm,
  showSelect as ttyShowSelect,
  showDiffView as ttyShowDiffView,
} from './tty.js';

// Classic adapter
export {
  showConfirm as classicShowConfirm,
  showSelect as classicShowSelect,
  showDiffView as classicShowDiffView,
  readLine,
  createInteractiveLoop,
  legacyColors,
  createLegacySpinner,
} from './classic.js';

// Auto-detecting functions
import { detectEnvironment } from './detect.js';
import * as tty from './tty.js';
import * as classic from './classic.js';

/**
 * Show confirmation dialog (auto-detects environment)
 */
export async function showConfirm(message: string): Promise<boolean> {
  const env = detectEnvironment();
  if (env.mode === 'tty') {
    return tty.showConfirm(message);
  }
  return classic.showConfirm(message);
}

/**
 * Show selection dialog (auto-detects environment)
 */
export async function showSelect<T = string>(
  title: string,
  options: Array<{ label: string; value: T; description?: string }>
): Promise<T | null> {
  const env = detectEnvironment();
  if (env.mode === 'tty') {
    return tty.showSelect(title, options);
  }
  return classic.showSelect(title, options);
}

/**
 * Show diff preview dialog (auto-detects environment)
 */
export async function showDiffView(
  filename: string,
  oldContent: string,
  newContent: string
): Promise<boolean> {
  const env = detectEnvironment();
  if (env.mode === 'tty') {
    return tty.showDiffView(filename, oldContent, newContent);
  }
  return classic.showDiffView(filename, oldContent, newContent);
}
