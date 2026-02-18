/**
 * Message box rendering utilities
 */

import boxen, { type Options as BoxenOptions } from 'boxen';
import cliTruncate from 'cli-truncate';
import stripAnsi from 'strip-ansi';
import terminalSize from 'terminal-size';
import { theme, icons } from './colors.js';
import type { Role, ToolCallInfo, RenderOptions } from './types.js';

/**
 * Get terminal width
 */
export function getTerminalWidth(): number {
  try {
    const size = terminalSize();
    return size.columns || 80;
  } catch {
    return 80;
  }
}

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
 * Render a tool call box
 */
export function renderToolCall(info: ToolCallInfo, options: RenderOptions = {}): string {
  const termWidth = options.width || getTerminalWidth();
  const maxWidth = termWidth - 8;

  // Format arguments as JSON
  let argsStr: string;
  try {
    argsStr = JSON.stringify(info.args, null, 2);
  } catch {
    argsStr = String(info.args);
  }

  // Truncate if too long
  const argsLines = argsStr.split('\n');
  const truncatedArgs = argsLines.length > 6
    ? argsLines.slice(0, 5).join('\n') + '\n...'
    : argsStr;

  // Build content
  const lines: string[] = [
    theme.highlight(info.name),
    theme.muted(truncatedArgs),
  ];

  // Add status line
  if (info.status === 'completed') {
    const resultPreview = info.result
      ? cliTruncate(info.result.replace(/\n/g, ' '), maxWidth - 20)
      : '';
    const durationStr = info.duration ? ` (${info.duration}ms)` : '';
    lines.push('');
    lines.push(`${theme.success(icons.success)} Completed${durationStr}`);
    if (resultPreview) {
      lines.push(theme.muted(resultPreview));
    }
  } else if (info.status === 'error') {
    lines.push('');
    lines.push(`${theme.error(icons.error)} Failed`);
    if (info.result) {
      lines.push(theme.error(cliTruncate(info.result, maxWidth - 4)));
    }
  } else if (info.status === 'running') {
    lines.push('');
    lines.push(`${theme.info(icons.thinking)} Running...`);
  }

  return boxen(lines.join('\n'), {
    title: `${icons.tool} Tool`,
    titleAlignment: 'left',
    borderColor: 'magenta',
    borderStyle: 'single',
    padding: { left: 1, right: 1, top: 0, bottom: 0 },
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

/**
 * Render inline tool call (compact, single line)
 */
export function renderToolCallInline(name: string, status: 'start' | 'end' = 'start'): string {
  if (status === 'start') {
    return theme.tool(`${icons.tool} ${name}`) + theme.muted(' ...');
  }
  return theme.tool(`${icons.tool} ${name}`) + theme.success(` ${icons.success}`);
}
