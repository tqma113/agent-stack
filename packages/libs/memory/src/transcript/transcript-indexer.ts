/**
 * @ai-stack/memory - Transcript Indexer
 *
 * Indexes session transcripts into semantic memory for searchability.
 * Watches for changes and automatically re-indexes.
 */

import type {
  ISemanticStore,
  SemanticChunkInput,
} from '@ai-stack/memory-store-sqlite';
import type {
  ISessionTranscript,
  TranscriptChunk,
  TranscriptMetadata,
  TranscriptSearchOptions,
  TranscriptSearchResult,
} from './session-transcript.js';

/**
 * Transcript indexer configuration
 */
export interface TranscriptIndexerConfig {
  /** Enable indexing (default: true) */
  enabled: boolean;

  /** Enable file watching (default: true) */
  watchEnabled: boolean;

  /** Debounce time for file changes in ms (default: 1500) */
  watchDebounceMs: number;

  /** Chunk size in tokens (default: 400) */
  chunkTokens: number;

  /** Overlap tokens between chunks (default: 80) */
  overlapTokens: number;

  /** Tags to apply to indexed chunks */
  indexTags: string[];

  /** Include system messages in index (default: false) */
  includeSystemMessages: boolean;

  /** Minimum content length to index (default: 20) */
  minContentLength: number;
}

/**
 * Default indexer configuration
 */
export const DEFAULT_INDEXER_CONFIG: TranscriptIndexerConfig = {
  enabled: true,
  watchEnabled: true,
  watchDebounceMs: 1500,
  chunkTokens: 400,
  overlapTokens: 80,
  indexTags: ['transcript', 'session'],
  includeSystemMessages: false,
  minContentLength: 20,
};

/**
 * Index entry metadata
 */
export interface IndexedTranscript {
  sessionId: string;
  chunkIds: string[];
  lastIndexedAt: number;
  entryCount: number;
  chunkCount: number;
}

/**
 * Sync result
 */
export interface SyncResult {
  /** Session ID */
  sessionId: string;

  /** Whether sync was successful */
  success: boolean;

  /** Chunks added */
  chunksAdded: number;

  /** Chunks removed */
  chunksRemoved: number;

  /** Chunks updated */
  chunksUpdated: number;

  /** Duration in ms */
  durationMs: number;

  /** Error if any */
  error?: Error;
}

/**
 * Transcript Indexer instance interface
 */
export interface ITranscriptIndexer {
  /** Get configuration */
  getConfig(): TranscriptIndexerConfig;

  /** Update configuration */
  setConfig(config: Partial<TranscriptIndexerConfig>): void;

  /**
   * Index a transcript into semantic store
   * @param transcript - The session transcript
   * @returns Sync result
   */
  indexTranscript(transcript: ISessionTranscript): Promise<SyncResult>;

  /**
   * Remove indexed chunks for a session
   * @param sessionId - Session to remove
   */
  removeIndex(sessionId: string): Promise<number>;

  /**
   * Get indexed session info
   * @param sessionId - Session ID
   */
  getIndexedInfo(sessionId: string): IndexedTranscript | undefined;

  /**
   * Get all indexed sessions
   */
  getAllIndexedSessions(): IndexedTranscript[];

  /**
   * Search transcripts
   * @param query - Search query
   * @param options - Search options
   */
  searchTranscripts(
    query: string,
    options?: TranscriptSearchOptions
  ): Promise<TranscriptSearchResult[]>;

  /**
   * Sync all transcripts (batch operation)
   * @param transcripts - Transcripts to sync
   * @param options - Sync options
   */
  syncAll(
    transcripts: ISessionTranscript[],
    options?: {
      force?: boolean;
      progress?: (current: number, total: number) => void;
    }
  ): Promise<SyncResult[]>;

  /**
   * Check if transcript needs re-indexing
   * @param transcript - Transcript to check
   */
  needsReindex(transcript: ISessionTranscript): boolean;

  /**
   * Clear all indexes
   */
  clearAll(): Promise<void>;
}

/**
 * Create a Transcript Indexer instance
 */
export function createTranscriptIndexer(
  semanticStore: ISemanticStore,
  initialConfig: Partial<TranscriptIndexerConfig> = {}
): ITranscriptIndexer {
  const config: TranscriptIndexerConfig = { ...DEFAULT_INDEXER_CONFIG, ...initialConfig };

  // Track indexed sessions
  const indexedSessions = new Map<string, IndexedTranscript>();

  /**
   * Convert transcript chunk to semantic chunk input
   */
  function chunkToSemanticInput(
    chunk: TranscriptChunk,
    metadata: TranscriptMetadata
  ): SemanticChunkInput {
    return {
      text: chunk.text,
      tags: [
        ...config.indexTags,
        `session:${chunk.sessionId}`,
        ...chunk.roles.map((r) => `role:${r}`),
      ],
      sourceType: 'transcript',
      sessionId: chunk.sessionId,
      metadata: {
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        timestampStart: chunk.timestampStart,
        timestampEnd: chunk.timestampEnd,
        sessionTitle: metadata.title,
      },
    };
  }

  /**
   * Filter chunks based on config
   */
  function filterChunks(chunks: TranscriptChunk[]): TranscriptChunk[] {
    return chunks.filter((chunk) => {
      // Check minimum content length
      if (chunk.text.length < config.minContentLength) {
        return false;
      }

      // Filter out system-only chunks if configured
      if (!config.includeSystemMessages) {
        if (chunk.roles.length === 1 && chunk.roles[0] === 'system') {
          return false;
        }
      }

      return true;
    });
  }

  return {
    getConfig(): TranscriptIndexerConfig {
      return { ...config };
    },

    setConfig(newConfig: Partial<TranscriptIndexerConfig>): void {
      Object.assign(config, newConfig);
    },

    async indexTranscript(transcript: ISessionTranscript): Promise<SyncResult> {
      const startTime = Date.now();
      const metadata = transcript.getMetadata();
      const sessionId = metadata.sessionId;

      if (!config.enabled) {
        return {
          sessionId,
          success: false,
          chunksAdded: 0,
          chunksRemoved: 0,
          chunksUpdated: 0,
          durationMs: 0,
          error: new Error('Indexing is disabled'),
        };
      }

      try {
        // Generate chunks
        const rawChunks = transcript.generateChunks({
          maxTokensPerChunk: config.chunkTokens,
          overlapTokens: config.overlapTokens,
        });

        // Filter chunks
        const chunks = filterChunks(rawChunks);

        // Remove existing chunks for this session
        const removedCount = await this.removeIndex(sessionId);

        // Add new chunks
        const chunkIds: string[] = [];
        for (const chunk of chunks) {
          const input = chunkToSemanticInput(chunk, metadata);
          const added = await semanticStore.add(input);
          chunkIds.push(added.id);
        }

        // Update index tracking
        indexedSessions.set(sessionId, {
          sessionId,
          chunkIds,
          lastIndexedAt: Date.now(),
          entryCount: metadata.entryCount,
          chunkCount: chunkIds.length,
        });

        return {
          sessionId,
          success: true,
          chunksAdded: chunkIds.length,
          chunksRemoved: removedCount,
          chunksUpdated: 0,
          durationMs: Date.now() - startTime,
        };
      } catch (error) {
        return {
          sessionId,
          success: false,
          chunksAdded: 0,
          chunksRemoved: 0,
          chunksUpdated: 0,
          durationMs: Date.now() - startTime,
          error: error as Error,
        };
      }
    },

    async removeIndex(sessionId: string): Promise<number> {
      const indexed = indexedSessions.get(sessionId);
      if (!indexed) {
        // Try to remove by session ID from store
        return semanticStore.deleteBySession(sessionId);
      }

      // Remove tracked chunks
      let removed = 0;
      for (const chunkId of indexed.chunkIds) {
        const chunk = await semanticStore.get(chunkId);
        if (chunk) {
          // Note: semantic store doesn't have delete by ID in interface
          // Use deleteBySession as fallback
          removed++;
        }
      }

      const actualRemoved = await semanticStore.deleteBySession(sessionId);
      indexedSessions.delete(sessionId);

      return actualRemoved;
    },

    getIndexedInfo(sessionId: string): IndexedTranscript | undefined {
      return indexedSessions.get(sessionId);
    },

    getAllIndexedSessions(): IndexedTranscript[] {
      return Array.from(indexedSessions.values());
    },

    async searchTranscripts(
      query: string,
      options?: TranscriptSearchOptions
    ): Promise<TranscriptSearchResult[]> {
      // Build tag filters
      const tags: string[] = ['transcript'];

      if (options?.sessionIds && options.sessionIds.length > 0) {
        // Note: Current semantic store doesn't support OR tag filters
        // This is a limitation - we'd need to search each session separately
        // For now, search all and filter results
      }

      if (options?.roles && options.roles.length > 0) {
        for (const role of options.roles) {
          tags.push(`role:${role}`);
        }
      }

      // Search semantic store
      const results = await semanticStore.search(query, {
        tags: tags.length > 1 ? tags : undefined,
        limit: (options?.limit ?? 10) * 2, // Get extra for filtering
      });

      // Convert to transcript search results
      const transcriptResults: TranscriptSearchResult[] = [];

      for (const result of results) {
        const chunk = result.chunk;

        // Filter by session ID if specified
        if (options?.sessionIds && options.sessionIds.length > 0) {
          if (!options.sessionIds.includes(chunk.sessionId || '')) {
            continue;
          }
        }

        // Filter by time range
        const metadata = chunk.metadata as Record<string, unknown> | undefined;
        if (options?.since && metadata?.timestampStart) {
          if ((metadata.timestampStart as number) < options.since) {
            continue;
          }
        }
        if (options?.until && metadata?.timestampEnd) {
          if ((metadata.timestampEnd as number) > options.until) {
            continue;
          }
        }

        transcriptResults.push({
          sessionId: chunk.sessionId || '',
          entry: {
            type: 'message',
            timestamp: (metadata?.timestampStart as number) || chunk.timestamp,
            message: {
              role: 'assistant', // Default, actual role is in the text
              content: chunk.text,
            },
          },
          score: result.score,
          snippet: createSnippet(chunk.text, query),
          lineNumber: (metadata?.startLine as number) || 0,
        });

        if (transcriptResults.length >= (options?.limit ?? 10)) {
          break;
        }
      }

      return transcriptResults;
    },

    async syncAll(
      transcripts: ISessionTranscript[],
      options?: {
        force?: boolean;
        progress?: (current: number, total: number) => void;
      }
    ): Promise<SyncResult[]> {
      const results: SyncResult[] = [];
      const total = transcripts.length;

      for (let i = 0; i < transcripts.length; i++) {
        const transcript = transcripts[i];

        // Check if needs re-indexing (unless forced)
        if (!options?.force && !this.needsReindex(transcript)) {
          results.push({
            sessionId: transcript.getMetadata().sessionId,
            success: true,
            chunksAdded: 0,
            chunksRemoved: 0,
            chunksUpdated: 0,
            durationMs: 0,
          });
          continue;
        }

        const result = await this.indexTranscript(transcript);
        results.push(result);

        if (options?.progress) {
          options.progress(i + 1, total);
        }
      }

      return results;
    },

    needsReindex(transcript: ISessionTranscript): boolean {
      const metadata = transcript.getMetadata();
      const indexed = indexedSessions.get(metadata.sessionId);

      if (!indexed) {
        return true;
      }

      // Check if entry count changed
      if (indexed.entryCount !== metadata.entryCount) {
        return true;
      }

      // Check if transcript was updated after indexing
      if (metadata.updatedAt > indexed.lastIndexedAt) {
        return true;
      }

      return false;
    },

    async clearAll(): Promise<void> {
      for (const sessionId of indexedSessions.keys()) {
        await semanticStore.deleteBySession(sessionId);
      }
      indexedSessions.clear();
    },
  };
}

/**
 * Create a snippet with highlighted match
 */
function createSnippet(text: string, query: string, maxLength = 200): string {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  const matchIndex = lowerText.indexOf(lowerQuery);
  if (matchIndex === -1) {
    // No direct match, return start of text
    return text.length > maxLength
      ? text.slice(0, maxLength - 3) + '...'
      : text;
  }

  // Center snippet around match
  const contextBefore = Math.floor((maxLength - query.length) / 2);
  const start = Math.max(0, matchIndex - contextBefore);
  const end = Math.min(text.length, start + maxLength);

  let snippet = text.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  return snippet;
}

/**
 * Debounce helper for file watching
 */
export function createDebouncer(delayMs: number): {
  debounce: (fn: () => void) => void;
  cancel: () => void;
} {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return {
    debounce(fn: () => void): void {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        timeoutId = null;
        fn();
      }, delayMs);
    },

    cancel(): void {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
  };
}
