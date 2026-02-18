/**
 * Message rendering utilities (uses strip-ansi for text wrapping)
 */

import boxen, { type Options as BoxenOptions } from 'boxen';
import stripAnsi from 'strip-ansi';
import { theme, icons } from './colors.js';
import { getTerminalWidth } from './box.js';
import type { Role, RenderOptions } from './types.js';

/**
 * Render a role label for message box title
 */
function getRoleLabel(role: Role): string {
  switch (role) {
    case 'user':
      return `${icons.user} You`;
    case 'agent':
      return `${icons.agent} Agent`;
    case 'system':
      return `${icons.info} System`;
    case 'tool':
      return `${icons.tool} Tool`;
    default:
      return role;
  }
}

/**
 * Get border color for role
 */
function getRoleBorderColor(role: Role): BoxenOptions['borderColor'] {
  switch (role) {
    case 'user':
      return 'green';
    case 'agent':
      return 'blue';
    case 'system':
      return 'gray';
    case 'tool':
      return 'magenta';
    default:
      return 'white';
  }
}

/**
 * Wrap text to fit within terminal width
 */
function wrapText(text: string, maxWidth: number): string {
  const lines: string[] = [];
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    if (stripAnsi(paragraph).length <= maxWidth) {
      lines.push(paragraph);
      continue;
    }

    const words = paragraph.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (stripAnsi(testLine).length <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) lines.push(currentLine);
  }

  return lines.join('\n');
}

/**
 * Render a message in a styled box
 */
export function renderMessage(
  role: Role,
  content: string,
  options: RenderOptions = {}
): string {
  const termWidth = options.width || getTerminalWidth();
  const padding = options.padding ?? 1;
  const maxContentWidth = termWidth - 6 - (padding * 2); // Account for borders and padding

  const wrappedContent = wrapText(content, maxContentWidth);
  const label = getRoleLabel(role);
  const borderColor = getRoleBorderColor(role);

  return boxen(wrappedContent, {
    title: label,
    titleAlignment: 'left',
    borderColor,
    borderStyle: 'round',
    padding: { left: padding, right: padding, top: 0, bottom: 0 },
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
  });
}

/**
 * Render a simple status box (for errors, warnings, info)
 */
export function renderStatusBox(
  type: 'success' | 'error' | 'warning' | 'info',
  message: string,
  options: RenderOptions = {}
): string {
  const termWidth = options.width || getTerminalWidth();
  const maxWidth = termWidth - 8;
  const wrappedMessage = wrapText(message, maxWidth);

  const iconMap = {
    success: icons.success,
    error: icons.error,
    warning: icons.warning,
    info: icons.info,
  };

  const colorMap = {
    success: 'green' as const,
    error: 'red' as const,
    warning: 'yellow' as const,
    info: 'cyan' as const,
  };

  return boxen(wrappedMessage, {
    title: iconMap[type],
    titleAlignment: 'left',
    borderColor: colorMap[type],
    borderStyle: 'round',
    padding: { left: 1, right: 1, top: 0, bottom: 0 },
    dimBorder: type === 'info',
  });
}
