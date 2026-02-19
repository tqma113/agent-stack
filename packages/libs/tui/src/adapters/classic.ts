/**
 * @ai-stack/tui - Classic Adapter
 *
 * Fallback for non-TTY environments (pipes, CI, etc.)
 */

import * as readline from 'readline';
import { legacyColors, icons } from '../core/colors.js';
import { createLegacySpinner } from '../core/spinner.js';
import { formatUnifiedDiff, getDiffSummary, computeDiff } from '../core/diff.js';

/**
 * Classic confirmation prompt
 */
export function showConfirm(message: string): Promise<boolean> {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log(`\n${legacyColors.yellow(icons.warning)} ${message}`);
    rl.question(`${legacyColors.gray('Confirm? [y/N]:')} `, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Classic selection prompt
 */
export function showSelect<T = string>(
  title: string,
  options: Array<{ label: string; value: T; description?: string }>
): Promise<T | null> {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log(`\n${legacyColors.cyan(title)}`);
    options.forEach((opt, i) => {
      console.log(`  ${legacyColors.bold(String(i + 1))}. ${opt.label}${opt.description ? ` - ${legacyColors.gray(opt.description)}` : ''}`);
    });

    rl.question(`${legacyColors.gray('Enter number (or press Enter to cancel):')} `, answer => {
      rl.close();
      const index = parseInt(answer, 10) - 1;
      if (isNaN(index) || index < 0 || index >= options.length) {
        resolve(null);
      } else {
        resolve(options[index].value);
      }
    });
  });
}

/**
 * Classic diff view
 */
export function showDiffView(
  filename: string,
  oldContent: string,
  newContent: string
): Promise<boolean> {
  return new Promise(resolve => {
    const diff = computeDiff(oldContent, newContent, filename);
    const summary = getDiffSummary(oldContent, newContent);

    console.log(`\n${legacyColors.cyan('--- Diff Preview ---')}`);
    console.log(`${legacyColors.bold(filename)} (${summary})`);
    console.log(formatUnifiedDiff(diff.unified));
    console.log(legacyColors.cyan('--- End Diff ---\n'));

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(`${legacyColors.yellow('Apply changes? [y/N]:')} `, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Classic text input
 */
export function readLine(prompt: string): Promise<string> {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(prompt, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Classic interactive loop
 */
export function createInteractiveLoop(options: {
  prompt?: string;
  onInput: (input: string) => Promise<void> | void;
  onExit?: () => void;
}) {
  const { prompt = '> ', onInput, onExit } = options;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = () => {
    rl.question(prompt, async answer => {
      const trimmed = answer.trim();

      if (trimmed === 'exit' || trimmed === 'quit') {
        rl.close();
        onExit?.();
        return;
      }

      if (trimmed) {
        await onInput(trimmed);
      }

      askQuestion();
    });
  };

  // Handle Ctrl+C
  rl.on('close', () => {
    onExit?.();
  });

  return {
    start: askQuestion,
    stop: () => rl.close(),
  };
}

// Export legacy utilities
export { legacyColors, createLegacySpinner };
