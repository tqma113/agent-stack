/**
 * Tests for Embedding Cache
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createEmbeddingCache, type EmbeddingCacheInstance } from '../../src/stores/embedding-cache.js';

describe('EmbeddingCache', () => {
  let db: Database.Database;
  let cache: EmbeddingCacheInstance;

  beforeEach(async () => {
    db = new Database(':memory:');
    cache = createEmbeddingCache({
      maxEntries: 100,
      ttlMs: 0, // No expiry for tests
    });
    cache.setDatabase(db);
    await cache.initialize();
  });

  afterEach(async () => {
    await cache.close();
    db.close();
  });

  describe('set and get', () => {
    it('should store and retrieve embeddings', async () => {
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      await cache.set('hello world', embedding, 'openai', 'text-embedding-3-small');

      const retrieved = await cache.get('hello world', 'openai', 'text-embedding-3-small');
      expect(retrieved).toEqual(embedding);
    });

    it('should return undefined for missing entries', async () => {
      const retrieved = await cache.get('not found', 'openai', 'text-embedding-3-small');
      expect(retrieved).toBeUndefined();
    });

    it('should differentiate by provider and model', async () => {
      const embedding1 = [0.1, 0.2];
      const embedding2 = [0.3, 0.4];

      await cache.set('test', embedding1, 'openai', 'model-a');
      await cache.set('test', embedding2, 'openai', 'model-b');

      const retrieved1 = await cache.get('test', 'openai', 'model-a');
      const retrieved2 = await cache.get('test', 'openai', 'model-b');

      expect(retrieved1).toEqual(embedding1);
      expect(retrieved2).toEqual(embedding2);
    });

    it('should overwrite existing entries', async () => {
      await cache.set('test', [0.1], 'provider', 'model');
      await cache.set('test', [0.2], 'provider', 'model');

      const retrieved = await cache.get('test', 'provider', 'model');
      expect(retrieved).toEqual([0.2]);
    });
  });

  describe('has', () => {
    it('should return true for existing entries', async () => {
      await cache.set('test', [0.1], 'provider', 'model');
      expect(await cache.has('test', 'provider', 'model')).toBe(true);
    });

    it('should return false for missing entries', async () => {
      expect(await cache.has('missing', 'provider', 'model')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete existing entries', async () => {
      await cache.set('test', [0.1], 'provider', 'model');
      const deleted = await cache.delete('test', 'provider', 'model');

      expect(deleted).toBe(true);
      expect(await cache.has('test', 'provider', 'model')).toBe(false);
    });

    it('should return false for non-existing entries', async () => {
      const deleted = await cache.delete('missing', 'provider', 'model');
      expect(deleted).toBe(false);
    });
  });

  describe('getBatch', () => {
    it('should retrieve multiple embeddings', async () => {
      await cache.set('text1', [0.1], 'provider', 'model');
      await cache.set('text2', [0.2], 'provider', 'model');
      await cache.set('text3', [0.3], 'provider', 'model');

      const results = await cache.getBatch(['text1', 'text2', 'text4'], 'provider', 'model');

      expect(results.size).toBe(2);
      expect(results.get('text1')).toEqual([0.1]);
      expect(results.get('text2')).toEqual([0.2]);
      expect(results.has('text4')).toBe(false);
    });

    it('should handle empty input', async () => {
      const results = await cache.getBatch([], 'provider', 'model');
      expect(results.size).toBe(0);
    });
  });

  describe('setBatch', () => {
    it('should store multiple embeddings', async () => {
      await cache.setBatch(
        [
          ['text1', [0.1]],
          ['text2', [0.2]],
          ['text3', [0.3]],
        ],
        'provider',
        'model'
      );

      expect(await cache.get('text1', 'provider', 'model')).toEqual([0.1]);
      expect(await cache.get('text2', 'provider', 'model')).toEqual([0.2]);
      expect(await cache.get('text3', 'provider', 'model')).toEqual([0.3]);
    });
  });

  describe('TTL expiration', () => {
    it('should expire old entries', async () => {
      const shortTtlCache = createEmbeddingCache({
        ttlMs: 100, // 100ms TTL
      });
      shortTtlCache.setDatabase(db);
      await shortTtlCache.initialize();

      await shortTtlCache.set('test', [0.1], 'provider', 'model');

      // Should exist immediately
      expect(await shortTtlCache.get('test', 'provider', 'model')).toEqual([0.1]);

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should be expired
      expect(await shortTtlCache.get('test', 'provider', 'model')).toBeUndefined();
    });
  });

  describe('getStats', () => {
    it('should return accurate statistics', async () => {
      await cache.set('text1', [0.1], 'openai', 'model-a');
      await cache.set('text2', [0.2], 'openai', 'model-a');
      await cache.set('text3', [0.3], 'openai', 'model-b');

      const stats = await cache.getStats();

      expect(stats.totalEntries).toBe(3);
      expect(stats.providers).toHaveLength(2);
      expect(stats.providers.find((p) => p.model === 'model-a')?.count).toBe(2);
      expect(stats.providers.find((p) => p.model === 'model-b')?.count).toBe(1);
    });
  });

  describe('prune', () => {
    it('should remove excess entries using LRU', async () => {
      const smallCache = createEmbeddingCache({
        maxEntries: 3,
        ttlMs: 0,
      });
      smallCache.setDatabase(db);
      await smallCache.initialize();

      // Add entries - the order matters for LRU
      await smallCache.set('entry1', [0.1], 'provider', 'model');
      await smallCache.set('entry2', [0.2], 'provider', 'model');
      await smallCache.set('entry3', [0.3], 'provider', 'model');
      await smallCache.set('entry4', [0.4], 'provider', 'model');
      await smallCache.set('entry5', [0.5], 'provider', 'model');

      await smallCache.prune();

      const stats = await smallCache.getStats();
      expect(stats.totalEntries).toBe(3);

      // Most recent entries should be kept
      expect(await smallCache.has('entry5', 'provider', 'model')).toBe(true);
      expect(await smallCache.has('entry4', 'provider', 'model')).toBe(true);
      expect(await smallCache.has('entry3', 'provider', 'model')).toBe(true);

      // Oldest entries should be removed
      expect(await smallCache.has('entry1', 'provider', 'model')).toBe(false);
      expect(await smallCache.has('entry2', 'provider', 'model')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', async () => {
      await cache.set('text1', [0.1], 'provider', 'model');
      await cache.set('text2', [0.2], 'provider', 'model');

      await cache.clear();

      const stats = await cache.getStats();
      expect(stats.totalEntries).toBe(0);
    });
  });

  describe('disabled cache', () => {
    it('should not store or retrieve when disabled', async () => {
      const disabledCache = createEmbeddingCache({ enabled: false });
      disabledCache.setDatabase(db);

      await disabledCache.set('test', [0.1], 'provider', 'model');
      const result = await disabledCache.get('test', 'provider', 'model');

      expect(result).toBeUndefined();
    });
  });
});
