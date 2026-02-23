/**
 * @ai-stack/tree-index - Path Utilities
 *
 * Utilities for working with hierarchical paths.
 */

/**
 * Normalize a path to consistent format
 * - Always starts with /
 * - No trailing slash (except for root /)
 * - No double slashes
 */
export function normalizePath(path: string): string {
  // Remove leading/trailing whitespace
  let normalized = path.trim();

  // Replace backslashes with forward slashes
  normalized = normalized.replace(/\\/g, '/');

  // Remove duplicate slashes
  normalized = normalized.replace(/\/+/g, '/');

  // Ensure leading slash
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }

  // Remove trailing slash (unless root)
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Get the parent path of a given path
 */
export function getParentPath(path: string): string | null {
  const normalized = normalizePath(path);

  // Root has no parent
  if (normalized === '/') {
    return null;
  }

  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash === 0) {
    return '/';
  }

  return normalized.slice(0, lastSlash);
}

/**
 * Get the name (last segment) from a path
 */
export function getNameFromPath(path: string): string {
  const normalized = normalizePath(path);

  if (normalized === '/') {
    return '';
  }

  const lastSlash = normalized.lastIndexOf('/');
  return normalized.slice(lastSlash + 1);
}

/**
 * Join path segments
 */
export function joinPath(...segments: string[]): string {
  if (segments.length === 0) {
    return '/';
  }

  const joined = segments
    .filter((s) => s.length > 0)
    .map((s) => s.replace(/^\/+|\/+$/g, ''))
    .join('/');

  return normalizePath(joined);
}

/**
 * Get all ancestor paths for a given path (from root to parent)
 */
export function getAncestorPaths(path: string): string[] {
  const normalized = normalizePath(path);
  const ancestors: string[] = [];

  let current = getParentPath(normalized);
  while (current !== null) {
    ancestors.unshift(current); // Add at beginning to maintain order
    current = getParentPath(current);
  }

  return ancestors;
}

/**
 * Calculate depth of a path (number of segments from root)
 */
export function getPathDepth(path: string): number {
  const normalized = normalizePath(path);

  if (normalized === '/') {
    return 0;
  }

  // Count slashes (minus 1 for leading slash)
  return normalized.split('/').length - 1;
}

/**
 * Check if pathA is an ancestor of pathB
 */
export function isAncestorOf(pathA: string, pathB: string): boolean {
  const normalizedA = normalizePath(pathA);
  const normalizedB = normalizePath(pathB);

  if (normalizedA === normalizedB) {
    return false;
  }

  if (normalizedA === '/') {
    return true;
  }

  return normalizedB.startsWith(normalizedA + '/');
}

/**
 * Check if pathA is a descendant of pathB
 */
export function isDescendantOf(pathA: string, pathB: string): boolean {
  return isAncestorOf(pathB, pathA);
}

/**
 * Get relative path from ancestor to descendant
 */
export function getRelativePath(ancestor: string, descendant: string): string | null {
  const normalizedAncestor = normalizePath(ancestor);
  const normalizedDescendant = normalizePath(descendant);

  if (!isAncestorOf(normalizedAncestor, normalizedDescendant)) {
    return null;
  }

  if (normalizedAncestor === '/') {
    return normalizedDescendant;
  }

  return normalizedDescendant.slice(normalizedAncestor.length);
}

/**
 * Split a path into segments
 */
export function splitPath(path: string): string[] {
  const normalized = normalizePath(path);

  if (normalized === '/') {
    return [];
  }

  return normalized.slice(1).split('/');
}

/**
 * Check if a path matches a glob pattern (simple implementation)
 * Supports: * (any segment), ** (any depth)
 */
export function matchesPattern(path: string, pattern: string): boolean {
  const pathSegments = splitPath(path);
  const patternSegments = splitPath(pattern);

  let pi = 0;
  let si = 0;

  while (pi < patternSegments.length && si < pathSegments.length) {
    const patternSeg = patternSegments[pi];

    if (patternSeg === '**') {
      // ** matches zero or more segments
      if (pi === patternSegments.length - 1) {
        return true; // ** at end matches everything
      }

      // Try to match remaining pattern
      for (let i = si; i <= pathSegments.length; i++) {
        if (matchesPattern(joinPath(...pathSegments.slice(i)), joinPath(...patternSegments.slice(pi + 1)))) {
          return true;
        }
      }
      return false;
    } else if (patternSeg === '*') {
      // * matches exactly one segment
      pi++;
      si++;
    } else if (patternSeg === pathSegments[si]) {
      // Exact match
      pi++;
      si++;
    } else {
      return false;
    }
  }

  // Handle trailing **
  while (pi < patternSegments.length && patternSegments[pi] === '**') {
    pi++;
  }

  return pi === patternSegments.length && si === pathSegments.length;
}
