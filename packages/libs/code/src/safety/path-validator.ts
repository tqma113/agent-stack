/**
 * @ai-stack/code - Path Validator
 *
 * Validates file paths against sandbox restrictions.
 */

import { resolve, relative, isAbsolute, normalize } from 'path';
import picomatch from 'picomatch';
import type { SafetyConfig } from '../types.js';
import { PathError } from '../errors.js';

/**
 * Path validation result
 */
export interface PathValidationResult {
  valid: boolean;
  normalizedPath: string;
  relativePath: string;
  error?: string;
}

/**
 * Create a path validator
 */
export function createPathValidator(config: Required<SafetyConfig>) {
  const { workingDir, allowedPaths, blockedPaths } = config;
  const normalizedWorkingDir = resolve(workingDir);

  // Compile matchers for performance
  const allowedMatchers = allowedPaths.map((pattern) =>
    picomatch(pattern, { dot: true, nocase: process.platform === 'win32' })
  );

  const blockedMatchers = blockedPaths.map((pattern) =>
    picomatch(pattern, { dot: true, nocase: process.platform === 'win32' })
  );

  /**
   * Validate a file path
   */
  function validate(filePath: string): PathValidationResult {
    // Normalize the path
    let normalizedPath: string;
    if (isAbsolute(filePath)) {
      normalizedPath = normalize(filePath);
    } else {
      normalizedPath = resolve(normalizedWorkingDir, filePath);
    }

    // Get relative path from working directory
    const relativePath = relative(normalizedWorkingDir, normalizedPath);

    // Check if path is within working directory (no '..' traversal)
    if (relativePath.startsWith('..')) {
      return {
        valid: false,
        normalizedPath,
        relativePath,
        error: `Path is outside working directory: ${filePath}`,
      };
    }

    // Check against blocked patterns first
    for (const matcher of blockedMatchers) {
      if (matcher(relativePath)) {
        return {
          valid: false,
          normalizedPath,
          relativePath,
          error: `Path is blocked: ${filePath}`,
        };
      }
    }

    // Check against allowed patterns
    let isAllowed = false;
    for (const matcher of allowedMatchers) {
      if (matcher(relativePath)) {
        isAllowed = true;
        break;
      }
    }

    if (!isAllowed) {
      return {
        valid: false,
        normalizedPath,
        relativePath,
        error: `Path is not in allowed list: ${filePath}`,
      };
    }

    return {
      valid: true,
      normalizedPath,
      relativePath,
    };
  }

  /**
   * Validate path and throw if invalid
   */
  function validateOrThrow(filePath: string): { normalizedPath: string; relativePath: string } {
    const result = validate(filePath);
    if (!result.valid) {
      throw new PathError(result.error!, filePath);
    }
    return {
      normalizedPath: result.normalizedPath,
      relativePath: result.relativePath,
    };
  }

  /**
   * Check if a path would be valid
   */
  function isValid(filePath: string): boolean {
    return validate(filePath).valid;
  }

  /**
   * Get the working directory
   */
  function getWorkingDir(): string {
    return normalizedWorkingDir;
  }

  return {
    validate,
    validateOrThrow,
    isValid,
    getWorkingDir,
  };
}

export type PathValidator = ReturnType<typeof createPathValidator>;
