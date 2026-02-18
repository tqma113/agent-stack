/**
 * Copy handlers.js to handlers.cjs for skill.json compatibility
 *
 * The skill loader expects CommonJS format with #export syntax for handler resolution.
 */

import { copyFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

const srcFile = resolve(rootDir, 'dist', 'handlers.cjs');
const destFile = resolve(rootDir, 'handlers.cjs');

if (existsSync(srcFile)) {
  copyFileSync(srcFile, destFile);
  console.log('Copied handlers.js to handlers.cjs');
} else {
  console.error('dist/handlers.js not found. Run build first.');
  process.exit(1);
}
