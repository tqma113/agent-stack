/**
 * @ai-stack/assistant - Hash Utilities
 *
 * Utility functions for computing file content hashes for incremental indexing.
 */

import { createHash } from 'crypto';
import { readFileSync, statSync, existsSync } from 'fs';

/**
 * File metadata for incremental indexing
 */
export interface FileMetadata {
  /** File path */
  path: string;
  /** Content hash (SHA-256) */
  hash: string;
  /** File size in bytes */
  size: number;
  /** Last modified timestamp (ms) */
  mtime: number;
}

/**
 * Compute SHA-256 hash of a string
 */
export function hashText(text: string): string {
  return createHash('sha256').update(text, 'utf-8').digest('hex');
}

/**
 * Compute SHA-256 hash of a file's content
 */
export function hashFile(filePath: string): string {
  if (!existsSync(filePath)) {
    return '';
  }
  const content = readFileSync(filePath, 'utf-8');
  return hashText(content);
}

/**
 * Get file metadata including hash
 */
export function getFileMetadata(filePath: string): FileMetadata | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const stat = statSync(filePath);
    const content = readFileSync(filePath, 'utf-8');
    const hash = hashText(content);

    return {
      path: filePath,
      hash,
      size: stat.size,
      mtime: stat.mtimeMs,
    };
  } catch {
    return null;
  }
}

/**
 * Check if file has changed by comparing hash
 */
export function hasFileChanged(filePath: string, previousHash: string): boolean {
  const currentHash = hashFile(filePath);
  return currentHash !== previousHash;
}

/**
 * Batch get metadata for multiple files
 */
export function getFilesMetadata(filePaths: string[]): Map<string, FileMetadata> {
  const result = new Map<string, FileMetadata>();

  for (const filePath of filePaths) {
    const metadata = getFileMetadata(filePath);
    if (metadata) {
      result.set(filePath, metadata);
    }
  }

  return result;
}
