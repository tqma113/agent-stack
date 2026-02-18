/**
 * Copy handlers.js to handlers.cjs for CommonJS compatibility
 */
import { copyFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');
const rootDir = join(__dirname, '..');

const source = join(distDir, 'handlers.js');
const dest = join(rootDir, 'handlers.cjs');

if (existsSync(source)) {
  copyFileSync(source, dest);
  console.log('Copied handlers.js to handlers.cjs');
} else {
  console.error('Source file not found:', source);
  process.exit(1);
}
