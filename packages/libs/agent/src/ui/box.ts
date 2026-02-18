/**
 * Box rendering utilities for tool calls
 */

import boxen from 'boxen';
import cliTruncate from 'cli-truncate';
import terminalSize from 'terminal-size';
import { theme, icons } from './colors.js';
import type { ToolCallInfo, RenderOptions } from './types.js';

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
 * Render inline tool call (compact, single line)
 */
export function renderToolCallInline(name: string, status: 'start' | 'end' = 'start'): string {
  if (status === 'start') {
    return theme.tool(`${icons.tool} ${name}`) + theme.muted(' ...');
  }
  return theme.tool(`${icons.tool} ${name}`) + theme.success(` ${icons.success}`);
}
