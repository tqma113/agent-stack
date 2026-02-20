/**
 * @ai-stack/tui - Theme colors and icons
 */

import chalk from 'chalk';

/**
 * Theme colors using chalk
 */
export const theme = {
  // Role colors
  user: chalk.green,
  agent: chalk.blue,
  system: chalk.gray,
  tool: chalk.magenta,

  // Status colors
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.cyan,

  // UI colors
  border: chalk.gray,
  muted: chalk.dim,
  highlight: chalk.bold,
  accent: chalk.cyan,
};

/**
 * Unicode icons
 */
export const icons = {
  user: '\u276f',      // ❯
  agent: '\u2726',     // ✦
  success: '\u2714',   // ✔
  error: '\u2716',     // ✖
  warning: '\u26a0',   // ⚠
  info: '\u2139',      // ℹ
  tool: '\u2699',      // ⚙
  thinking: '\u2022',  // •
  arrow: '\u2192',     // →
  add: '+',
  remove: '-',
  unchanged: ' ',
  undo: '\u21b6',      // ↶
  redo: '\u21b7',      // ↷
  task: '\u2611',      // ☑
  taskPending: '\u2610', // ☐
  folder: '\u{1f4c1}', // 📁
  file: '\u{1f4c4}',   // 📄
  question: '?',       // ?
};

/**
 * Border characters for boxes
 */
export const borders = {
  rounded: {
    topLeft: '\u256d',     // ╭
    topRight: '\u256e',    // ╮
    bottomLeft: '\u2570',  // ╰
    bottomRight: '\u256f', // ╯
    horizontal: '\u2500',  // ─
    vertical: '\u2502',    // │
  },
  square: {
    topLeft: '\u250c',     // ┌
    topRight: '\u2510',    // ┐
    bottomLeft: '\u2514',  // └
    bottomRight: '\u2518', // ┘
    horizontal: '\u2500',  // ─
    vertical: '\u2502',    // │
  },
  double: {
    topLeft: '\u2554',     // ╔
    topRight: '\u2557',    // ╗
    bottomLeft: '\u255a',  // ╚
    bottomRight: '\u255d',  // ╝
    horizontal: '\u2550',  // ═
    vertical: '\u2551',    // ║
  },
};

/**
 * Legacy colors for classic mode (no external dependencies)
 */
export const legacyColors = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
  magenta: (s: string) => `\x1b[35m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};
