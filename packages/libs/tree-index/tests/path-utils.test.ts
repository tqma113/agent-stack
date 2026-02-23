/**
 * @ai-stack/tree-index - Path Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import {
  normalizePath,
  getParentPath,
  getNameFromPath,
  joinPath,
  getAncestorPaths,
  getPathDepth,
  isAncestorOf,
  isDescendantOf,
  getRelativePath,
  splitPath,
  matchesPattern,
} from '../src/utils/path-utils.js';

describe('Path Utilities', () => {
  describe('normalizePath', () => {
    it('should add leading slash', () => {
      expect(normalizePath('src/utils')).toBe('/src/utils');
    });

    it('should remove trailing slash', () => {
      expect(normalizePath('/src/utils/')).toBe('/src/utils');
    });

    it('should preserve root path', () => {
      expect(normalizePath('/')).toBe('/');
    });

    it('should remove duplicate slashes', () => {
      expect(normalizePath('//src//utils//')).toBe('/src/utils');
    });

    it('should convert backslashes', () => {
      expect(normalizePath('\\src\\utils')).toBe('/src/utils');
    });
  });

  describe('getParentPath', () => {
    it('should return parent path', () => {
      expect(getParentPath('/src/utils/helpers.ts')).toBe('/src/utils');
    });

    it('should return root for direct child', () => {
      expect(getParentPath('/src')).toBe('/');
    });

    it('should return null for root', () => {
      expect(getParentPath('/')).toBeNull();
    });
  });

  describe('getNameFromPath', () => {
    it('should extract name from path', () => {
      expect(getNameFromPath('/src/utils/helpers.ts')).toBe('helpers.ts');
    });

    it('should handle root path', () => {
      expect(getNameFromPath('/')).toBe('');
    });

    it('should handle single segment', () => {
      expect(getNameFromPath('/src')).toBe('src');
    });
  });

  describe('joinPath', () => {
    it('should join path segments', () => {
      expect(joinPath('src', 'utils', 'helpers.ts')).toBe('/src/utils/helpers.ts');
    });

    it('should handle leading slashes', () => {
      expect(joinPath('/src', '/utils')).toBe('/src/utils');
    });

    it('should handle empty segments', () => {
      expect(joinPath('src', '', 'utils')).toBe('/src/utils');
    });
  });

  describe('getAncestorPaths', () => {
    it('should return all ancestor paths', () => {
      const ancestors = getAncestorPaths('/src/utils/helpers.ts');
      expect(ancestors).toEqual(['/', '/src', '/src/utils']);
    });

    it('should return empty for root', () => {
      expect(getAncestorPaths('/')).toEqual([]);
    });

    it('should return only root for direct child', () => {
      expect(getAncestorPaths('/src')).toEqual(['/']);
    });
  });

  describe('getPathDepth', () => {
    it('should return depth', () => {
      expect(getPathDepth('/src/utils/helpers.ts')).toBe(3);
    });

    it('should return 0 for root', () => {
      expect(getPathDepth('/')).toBe(0);
    });

    it('should return 1 for direct child', () => {
      expect(getPathDepth('/src')).toBe(1);
    });
  });

  describe('isAncestorOf', () => {
    it('should return true for ancestor', () => {
      expect(isAncestorOf('/src', '/src/utils/helpers.ts')).toBe(true);
    });

    it('should return false for non-ancestor', () => {
      expect(isAncestorOf('/lib', '/src/utils')).toBe(false);
    });

    it('should return false for same path', () => {
      expect(isAncestorOf('/src', '/src')).toBe(false);
    });

    it('should handle root as ancestor', () => {
      expect(isAncestorOf('/', '/src/utils')).toBe(true);
    });
  });

  describe('isDescendantOf', () => {
    it('should return true for descendant', () => {
      expect(isDescendantOf('/src/utils/helpers.ts', '/src')).toBe(true);
    });

    it('should return false for non-descendant', () => {
      expect(isDescendantOf('/lib/core.ts', '/src')).toBe(false);
    });
  });

  describe('getRelativePath', () => {
    it('should return relative path', () => {
      expect(getRelativePath('/src', '/src/utils/helpers.ts')).toBe('/utils/helpers.ts');
    });

    it('should return null for non-ancestor', () => {
      expect(getRelativePath('/lib', '/src/utils')).toBeNull();
    });

    it('should handle root ancestor', () => {
      expect(getRelativePath('/', '/src/utils')).toBe('/src/utils');
    });
  });

  describe('splitPath', () => {
    it('should split path into segments', () => {
      expect(splitPath('/src/utils/helpers.ts')).toEqual(['src', 'utils', 'helpers.ts']);
    });

    it('should return empty array for root', () => {
      expect(splitPath('/')).toEqual([]);
    });
  });

  describe('matchesPattern', () => {
    it('should match exact path', () => {
      expect(matchesPattern('/src/utils', '/src/utils')).toBe(true);
    });

    it('should match with wildcard *', () => {
      expect(matchesPattern('/src/utils', '/src/*')).toBe(true);
    });

    it('should match with double wildcard **', () => {
      expect(matchesPattern('/src/utils/helpers.ts', '/src/**')).toBe(true);
    });

    it('should not match different paths', () => {
      expect(matchesPattern('/lib/core.ts', '/src/*')).toBe(false);
    });

    it('should match nested paths with **', () => {
      expect(matchesPattern('/src/a/b/c/d.ts', '/**/d.ts')).toBe(true);
    });
  });
});
