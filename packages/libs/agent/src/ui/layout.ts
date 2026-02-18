/**
 * Layout components for CLI header and footer
 */

import boxen from 'boxen';
import { theme, icons } from './colors.js';
import { getTerminalWidth } from './box.js';
import type { HeaderInfo, FooterInfo } from './types.js';

/**
 * Render CLI header with version, model, and tool info
 */
export function renderHeader(info: HeaderInfo): string {
  const termWidth = getTerminalWidth();

  // Title line
  const title = theme.highlight(`${icons.agent} Agent Stack CLI`);
  const version = theme.muted(`v${info.version}`);

  // Info items
  const items: string[] = [];
  items.push(`${theme.accent('Model:')} ${info.model}`);
  items.push(`${theme.accent('Tools:')} ${info.toolCount} available`);
  if (info.configPath) {
    items.push(`${theme.accent('Config:')} ${theme.muted(info.configPath)}`);
  }

  const content = [
    `${title} ${version}`,
    '',
    ...items,
  ].join('\n');

  return boxen(content, {
    borderColor: 'blue',
    borderStyle: 'round',
    padding: { left: 1, right: 1, top: 0, bottom: 0 },
    margin: { top: 0, bottom: 1, left: 0, right: 0 },
  });
}

/**
 * Render a simple header line (more compact)
 */
export function renderHeaderLine(info: HeaderInfo): string {
  const parts = [
    theme.highlight(`${icons.agent} Agent Stack CLI`) + theme.muted(` v${info.version}`),
    theme.muted('|'),
    `${theme.accent('Model:')} ${info.model}`,
    theme.muted('|'),
    `${theme.accent('Tools:')} ${info.toolCount}`,
  ];

  return parts.join(' ');
}

/**
 * Render CLI footer with session info
 */
export function renderFooter(info: FooterInfo): string {
  const parts: string[] = [];

  if (info.workDir) {
    parts.push(`${theme.muted('Dir:')} ${info.workDir}`);
  }

  if (info.sessionId) {
    parts.push(`${theme.muted('Session:')} ${info.sessionId.slice(0, 8)}`);
  }

  if (info.tokenUsage) {
    const { prompt, completion, total } = info.tokenUsage;
    parts.push(`${theme.muted('Tokens:')} ${total} (${prompt}+${completion})`);
  }

  if (parts.length === 0) return '';

  return theme.muted(parts.join(' | '));
}

/**
 * Render welcome message with tips
 */
export function renderWelcome(): string {
  const tips = [
    `Type ${theme.accent('/help')} for commands`,
    `Type ${theme.accent('/tools')} to list tools`,
    `Type ${theme.accent('exit')} or press ${theme.accent('Ctrl+C')} to quit`,
  ];

  return theme.muted(tips.join('  |  '));
}

/**
 * Render a divider line
 */
export function renderDivider(char = '\u2500'): string {
  const width = Math.min(getTerminalWidth() - 4, 60);
  return theme.muted(char.repeat(width));
}

/**
 * Render the input prompt
 */
export function renderPrompt(): string {
  return theme.user(`${icons.user} You: `);
}

/**
 * Render agent response prefix
 */
export function renderAgentPrefix(): string {
  return theme.agent(`${icons.agent} Agent: `);
}
