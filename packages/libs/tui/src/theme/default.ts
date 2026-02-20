/**
 * @ai-stack/tui - Default Theme
 */

import type { Theme } from './types.js';

export const defaultTheme: Theme = {
  name: 'default',
  colors: {
    // Role colors
    user: 'green',
    agent: 'blue',
    system: 'gray',
    tool: 'magenta',

    // Status colors
    success: 'green',
    error: 'red',
    warning: 'yellow',
    info: 'cyan',

    // UI colors
    border: 'gray',
    muted: 'gray',
    highlight: 'white',
    accent: 'cyan',
    background: 'black',
    foreground: 'white',

    // Diff colors
    diffAdd: 'green',
    diffRemove: 'red',
    diffUnchanged: 'gray',
  },
  icons: {
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
  },
};
