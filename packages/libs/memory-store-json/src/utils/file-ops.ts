/**
 * @agent-stack/memory-store-json - File Operations
 *
 * Utilities for reading and writing JSON/Markdown files.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Ensure a directory exists, creating it recursively if needed
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Read JSON file, returning default value if file doesn't exist
 */
export function readJsonFile<T>(filePath: string, defaultValue: T): T {
  try {
    if (!fs.existsSync(filePath)) {
      return defaultValue;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Write JSON file atomically (write to temp then rename)
 */
export function writeJsonFile<T>(filePath: string, data: T): void {
  ensureDir(path.dirname(filePath));
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempPath, filePath);
}

/**
 * Read Markdown file, returning default value if file doesn't exist
 */
export function readMarkdownFile(filePath: string, defaultValue = ''): string {
  try {
    if (!fs.existsSync(filePath)) {
      return defaultValue;
    }
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return defaultValue;
  }
}

/**
 * Write Markdown file atomically
 */
export function writeMarkdownFile(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, content, 'utf-8');
  fs.renameSync(tempPath, filePath);
}

/**
 * Delete file if exists
 */
export function deleteFile(filePath: string): boolean {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Delete directory recursively if exists
 */
export function deleteDir(dirPath: string): boolean {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * List directories in a path
 */
export function listDirs(dirPath: string): string[] {
  try {
    if (!fs.existsSync(dirPath)) {
      return [];
    }
    return fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
  } catch {
    return [];
  }
}

/**
 * List files in a path with optional extension filter
 */
export function listFiles(dirPath: string, ext?: string): string[] {
  try {
    if (!fs.existsSync(dirPath)) {
      return [];
    }
    let files = fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(dirent => dirent.isFile())
      .map(dirent => dirent.name);

    if (ext) {
      files = files.filter(f => f.endsWith(ext));
    }

    return files;
  } catch {
    return [];
  }
}

/**
 * Generate UUID v4
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Get current timestamp in milliseconds
 */
export function now(): number {
  return Date.now();
}
