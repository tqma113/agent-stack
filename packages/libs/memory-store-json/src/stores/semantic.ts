/**
 * @ai-stack/memory-store-json - Semantic Store
 *
 * JSON-based semantic storage with simple full-text search using inverted index.
 */

import * as path from 'node:path';
import type {
  ISemanticStore,
  SemanticChunk,
  SemanticChunkInput,
  SemanticSearchResult,
  UUID,
} from '@ai-stack/memory-store-sqlite';
import {
  readJsonFile,
  writeJsonFile,
  ensureDir,
  deleteDir,
  generateId,
  now,
} from '../utils/file-ops.js';

/**
 * Chunks data structure
 */
interface ChunksData {
  chunks: SemanticChunk[];
}

/**
 * Inverted index entry
 */
interface IndexEntry {
  chunkId: UUID;
  positions: number[]; // Word positions for proximity scoring
}

/**
 * Index data structure
 */
interface IndexData {
  // term -> list of chunk IDs with positions
  terms: Record<string, IndexEntry[]>;
}

/**
 * JSON Semantic Store configuration
 */
export interface JsonSemanticStoreConfig {
  basePath: string;
}

/**
 * Tokenize text into lowercase terms
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1);
}

/**
 * Calculate TF-IDF-like score for search results
 */
function calculateScore(
  matchedTerms: Set<string>,
  totalQueryTerms: number,
  termFrequency: Map<string, number>,
  totalChunks: number,
  documentFrequency: Map<string, number>
): number {
  let score = 0;

  for (const term of matchedTerms) {
    const tf = termFrequency.get(term) || 0;
    const df = documentFrequency.get(term) || 1;
    const idf = Math.log(totalChunks / df + 1);
    score += tf * idf;
  }

  // Boost score based on percentage of query terms matched
  const matchRatio = matchedTerms.size / totalQueryTerms;
  score *= (1 + matchRatio);

  return score;
}

/**
 * Create a JSON Semantic Store instance
 */
export function createJsonSemanticStore(config: JsonSemanticStoreConfig): ISemanticStore {
  const semanticDir = path.join(config.basePath, 'semantic');
  const chunksPath = path.join(semanticDir, 'chunks.json');
  const indexPath = path.join(semanticDir, 'index.json');
  let initialized = false;

  /**
   * Read chunks
   */
  function readChunks(): SemanticChunk[] {
    const data = readJsonFile<ChunksData>(chunksPath, { chunks: [] });
    return data.chunks;
  }

  /**
   * Write chunks
   */
  function writeChunks(chunks: SemanticChunk[]): void {
    writeJsonFile(chunksPath, { chunks });
  }

  /**
   * Read index
   */
  function readIndex(): IndexData {
    return readJsonFile<IndexData>(indexPath, { terms: {} });
  }

  /**
   * Write index
   */
  function writeIndex(index: IndexData): void {
    writeJsonFile(indexPath, index);
  }

  /**
   * Add chunk to index
   */
  function addToIndex(chunk: SemanticChunk, index: IndexData): void {
    const terms = tokenize(chunk.text);

    terms.forEach((term, position) => {
      if (!index.terms[term]) {
        index.terms[term] = [];
      }

      // Find existing entry for this chunk
      let entry = index.terms[term].find(e => e.chunkId === chunk.id);
      if (!entry) {
        entry = { chunkId: chunk.id, positions: [] };
        index.terms[term].push(entry);
      }
      entry.positions.push(position);
    });
  }

  /**
   * Remove chunk from index
   */
  function removeFromIndex(chunkId: UUID, index: IndexData): void {
    for (const term in index.terms) {
      index.terms[term] = index.terms[term].filter(e => e.chunkId !== chunkId);
      if (index.terms[term].length === 0) {
        delete index.terms[term];
      }
    }
  }

  return {
    async initialize(): Promise<void> {
      ensureDir(semanticDir);
      initialized = true;
    },

    async close(): Promise<void> {
      initialized = false;
    },

    async clear(): Promise<void> {
      deleteDir(semanticDir);
      ensureDir(semanticDir);
    },

    async add(input: SemanticChunkInput): Promise<SemanticChunk> {
      const chunk: SemanticChunk = {
        ...input,
        id: generateId(),
        timestamp: now(),
      };

      // Add to chunks
      const chunks = readChunks();
      chunks.push(chunk);
      writeChunks(chunks);

      // Add to index
      const index = readIndex();
      addToIndex(chunk, index);
      writeIndex(index);

      return chunk;
    },

    async get(id: UUID): Promise<SemanticChunk | null> {
      const chunks = readChunks();
      return chunks.find(c => c.id === id) || null;
    },

    async searchFts(
      query: string,
      options?: {
        tags?: string[];
        sessionId?: string;
        limit?: number;
      }
    ): Promise<SemanticSearchResult[]> {
      const queryTerms = tokenize(query);
      if (queryTerms.length === 0) return [];

      const chunks = readChunks();
      const index = readIndex();

      // Calculate document frequency for each query term
      const documentFrequency = new Map<string, number>();
      for (const term of queryTerms) {
        const entries = index.terms[term] || [];
        documentFrequency.set(term, entries.length);
      }

      // Find matching chunks and calculate scores
      const results: Map<UUID, { matchedTerms: Set<string>; termFrequency: Map<string, number> }> = new Map();

      for (const term of queryTerms) {
        const entries = index.terms[term] || [];
        for (const entry of entries) {
          if (!results.has(entry.chunkId)) {
            results.set(entry.chunkId, {
              matchedTerms: new Set(),
              termFrequency: new Map(),
            });
          }
          const result = results.get(entry.chunkId)!;
          result.matchedTerms.add(term);
          result.termFrequency.set(term, (result.termFrequency.get(term) || 0) + entry.positions.length);
        }
      }

      // Build search results
      let searchResults: SemanticSearchResult[] = [];
      const chunkMap = new Map(chunks.map(c => [c.id, c]));

      for (const [chunkId, { matchedTerms, termFrequency }] of results) {
        const chunk = chunkMap.get(chunkId);
        if (!chunk) continue;

        // Apply filters
        if (options?.tags && options.tags.length > 0) {
          if (!options.tags.some(tag => chunk.tags.includes(tag))) continue;
        }
        if (options?.sessionId && chunk.sessionId !== options.sessionId) continue;

        const score = calculateScore(
          matchedTerms,
          queryTerms.length,
          termFrequency,
          chunks.length,
          documentFrequency
        );

        searchResults.push({
          chunk,
          score,
          matchType: 'fts',
        });
      }

      // Sort by score descending
      searchResults.sort((a, b) => b.score - a.score);

      // Apply limit
      if (options?.limit) {
        searchResults = searchResults.slice(0, options.limit);
      }

      return searchResults;
    },

    async searchVector(
      embedding: number[],
      options?: {
        tags?: string[];
        sessionId?: string;
        limit?: number;
      }
    ): Promise<SemanticSearchResult[]> {
      // Vector search not supported in JSON store
      // Return empty results
      return [];
    },

    async search(
      query: string,
      options?: {
        tags?: string[];
        sessionId?: string;
        limit?: number;
        useVector?: boolean;
      }
    ): Promise<SemanticSearchResult[]> {
      // JSON store only supports FTS, ignore useVector
      return this.searchFts(query, options);
    },

    async deleteBySession(sessionId: string): Promise<number> {
      const chunks = readChunks();
      const toDelete = chunks.filter(c => c.sessionId === sessionId);

      if (toDelete.length === 0) return 0;

      // Remove from index
      const index = readIndex();
      for (const chunk of toDelete) {
        removeFromIndex(chunk.id, index);
      }
      writeIndex(index);

      // Remove from chunks
      const remaining = chunks.filter(c => c.sessionId !== sessionId);
      writeChunks(remaining);

      return toDelete.length;
    },
  };
}
