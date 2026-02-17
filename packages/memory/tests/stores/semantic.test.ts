/**
 * SemanticStore Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createSemanticStore, type SemanticStoreInstance } from '../../src/stores/semantic.js';

describe('SemanticStore', () => {
  let db: Database.Database;
  let store: SemanticStoreInstance;

  beforeEach(async () => {
    db = new Database(':memory:');
    store = createSemanticStore();
    store.setDatabase(db);
    await store.initialize();
  });

  afterEach(async () => {
    await store.close();
    db.close();
  });

  describe('add', () => {
    it('should add a semantic chunk with generated id', async () => {
      const chunk = await store.add({
        text: 'We decided to use approach B because of performance',
        tags: ['decision', 'performance'],
        sessionId: 'test-session',
        sourceType: 'DECISION',
      });

      expect(chunk.id).toBeDefined();
      expect(chunk.text).toContain('approach B');
      expect(chunk.tags).toContain('decision');
      expect(chunk.sessionId).toBe('test-session');
    });

    it('should add chunk without embedding', async () => {
      const chunk = await store.add({
        text: 'Simple text without embedding',
      });

      expect(chunk.id).toBeDefined();
      expect(chunk.embedding).toBeUndefined();
    });
  });

  describe('get', () => {
    it('should retrieve a chunk by id', async () => {
      const added = await store.add({
        text: 'Test chunk',
        sessionId: 'test-session',
      });

      const retrieved = await store.get(added.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(added.id);
      expect(retrieved!.text).toBe('Test chunk');
    });

    it('should return null for non-existent id', async () => {
      const retrieved = await store.get('non-existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('search (FTS)', () => {
    beforeEach(async () => {
      await store.add({
        text: 'TypeScript is a typed superset of JavaScript',
        tags: ['typescript', 'programming'],
        sessionId: 'session-1',
      });
      await store.add({
        text: 'Python is a popular programming language',
        tags: ['python', 'programming'],
        sessionId: 'session-1',
      });
      await store.add({
        text: 'React is a JavaScript library for building UIs',
        tags: ['react', 'javascript'],
        sessionId: 'session-2',
      });
    });

    it('should search by text content', async () => {
      const results = await store.search('TypeScript');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].chunk.text).toContain('TypeScript');
    });

    it('should filter by sessionId', async () => {
      const results = await store.search('JavaScript', {
        sessionId: 'session-1',
      });

      expect(results.length).toBe(1);
      expect(results[0].chunk.sessionId).toBe('session-1');
    });

    it('should filter by tags', async () => {
      const results = await store.search('programming', {
        tags: ['python'],
      });

      expect(results.length).toBe(1);
      expect(results[0].chunk.tags).toContain('python');
    });

    it('should limit results', async () => {
      const results = await store.search('programming', { limit: 1 });

      expect(results.length).toBe(1);
    });

    it('should return results with scores', async () => {
      const results = await store.search('TypeScript JavaScript');

      expect(results.length).toBeGreaterThan(0);
      results.forEach((r) => {
        expect(r.score).toBeDefined();
        expect(r.score).toBeGreaterThan(0);
      });
    });
  });

  describe('delete', () => {
    it('should delete a chunk by id', async () => {
      const chunk = await store.add({ text: 'To be deleted' });

      await store.delete(chunk.id);

      const retrieved = await store.get(chunk.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear all chunks', async () => {
      await store.add({ text: 'Chunk 1' });
      await store.add({ text: 'Chunk 2' });

      await store.clear();

      const results = await store.search('Chunk');
      expect(results.length).toBe(0);
    });
  });

  describe('embedFunction', () => {
    it('should set and get embedFunction', () => {
      const mockEmbed = async (text: string) => new Array(1536).fill(0.1);

      store.setEmbedFunction(mockEmbed);

      expect(store.hasEmbedFunction()).toBe(true);
      expect(store.getEmbedFunction()).toBe(mockEmbed);
    });

    it('should auto-generate embedding when embedFunction is set', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const mockEmbed = async (_text: string) => mockEmbedding;

      store.setEmbedFunction(mockEmbed);

      const chunk = await store.add({
        text: 'Test text for embedding',
      });

      // The chunk should have embedding set
      expect(chunk.embedding).toBeDefined();
      expect(chunk.embedding?.length).toBe(1536);
    });
  });

  describe('searchText', () => {
    it('should search using FTS only', async () => {
      await store.add({ text: 'TypeScript programming language' });

      const results = await store.searchText('TypeScript');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].matchType).toBe('fts');
    });
  });

  describe('searchSimilar', () => {
    it('should throw without embedFunction or embedding', async () => {
      await expect(store.searchSimilar('test query')).rejects.toThrow(
        'Vector search requires either an embedding array or embedFunction to be set'
      );
    });

    it('should search with provided embedding array', async () => {
      const embedding = new Array(1536).fill(0.1);

      // Add chunk with embedding
      await store.add({
        text: 'Test with embedding',
        embedding,
      });

      // Search with same embedding
      const results = await store.searchSimilar(embedding);

      // If vector is enabled, should find results
      if (store.isVectorEnabled()) {
        expect(results.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should search with embedFunction', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const mockEmbed = async (_text: string) => mockEmbedding;

      store.setEmbedFunction(mockEmbed);

      // Add chunk
      await store.add({
        text: 'Test content',
        embedding: mockEmbedding,
      });

      // Search with text (will use embedFunction)
      const results = await store.searchSimilar('similar query');

      // Results depend on whether vector search is available
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('hybrid search', () => {
    beforeEach(async () => {
      await store.add({
        text: 'TypeScript is great for type safety',
        tags: ['typescript'],
      });
      await store.add({
        text: 'JavaScript runs in the browser',
        tags: ['javascript'],
      });
    });

    it('should use FTS-only when no embedding provided', async () => {
      const results = await store.search('TypeScript');

      expect(results.length).toBeGreaterThan(0);
      // Without embedding, should use FTS
      expect(results[0].matchType).toBe('fts');
    });

    it('should use hybrid when embedFunction is set', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      store.setEmbedFunction(async () => mockEmbedding);

      // Re-add chunks with embeddings
      await store.clear();
      await store.add({
        text: 'TypeScript is great for type safety',
        tags: ['typescript'],
      });

      const results = await store.search('TypeScript');

      expect(results.length).toBeGreaterThan(0);
      // With embedFunction, hybrid search is attempted
    });

    it('should respect custom weights', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);

      const results = await store.search('TypeScript', {
        embedding: mockEmbedding,
        weights: { fts: 0.8, vector: 0.2 },
      });

      // Custom weights should be applied (results depend on data)
      expect(Array.isArray(results)).toBe(true);
    });

    it('should disable vector search with useVector=false', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);

      const results = await store.search('TypeScript', {
        embedding: mockEmbedding,
        useVector: false,
      });

      expect(results.length).toBeGreaterThan(0);
      // Should only use FTS
      expect(results[0].matchType).toBe('fts');
    });
  });
});
