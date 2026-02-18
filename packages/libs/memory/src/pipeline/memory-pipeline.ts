/**
 * @ai-stack/memory - Memory Pipeline
 *
 * Complete read/write pipeline for memory operations.
 *
 * Write Flow:
 *   Agent call → Write to store/file → Chunking → Embedding → Index
 *
 * Read Flow:
 *   Query → Hybrid search → Merge results → Temporal decay → MMR → Return
 */

import type {
  MemoryEvent,
  EventInput,
  SemanticChunk,
  SemanticChunkInput,
  SemanticSearchResult,
  IEventStore,
  ISemanticStore,
  ISummaryStore,
  IProfileStore,
  EmbedFunction,
} from '@ai-stack/memory-store-sqlite';
import {
  applyTemporalDecay,
  type TemporalDecayConfig,
  type DecayedSearchResult,
} from '../ranking/temporal-decay.js';
import {
  applyMMR,
  type MMRConfig,
  type MMRSearchResult,
} from '../ranking/mmr.js';
import type { ISessionTranscript, TranscriptChunk } from '../transcript/session-transcript.js';
import type { ITranscriptIndexer } from '../transcript/transcript-indexer.js';
import type { IMemoryFlush, FlushContent } from '../compaction/memory-flush.js';

/**
 * Write pipeline configuration
 */
export interface WritePipelineConfig {
  /** Enable automatic chunking (default: true) */
  autoChunk: boolean;

  /** Chunk size in tokens (default: 400) */
  chunkTokens: number;

  /** Overlap tokens (default: 80) */
  overlapTokens: number;

  /** Enable automatic embedding (default: true) */
  autoEmbed: boolean;

  /** Enable transcript indexing (default: true) */
  indexTranscripts: boolean;

  /** Tags to add to all written chunks */
  defaultTags: string[];

  /** Minimum content length to write (default: 20) */
  minContentLength: number;
}

/**
 * Read pipeline configuration
 */
export interface ReadPipelineConfig {
  /** Enable hybrid search (FTS + Vector) */
  hybridSearch: boolean;

  /** FTS weight in hybrid search (default: 0.3) */
  ftsWeight: number;

  /** Vector weight in hybrid search (default: 0.7) */
  vectorWeight: number;

  /** Enable temporal decay (default: true) */
  temporalDecay: boolean;

  /** Temporal decay config */
  temporalDecayConfig: Partial<TemporalDecayConfig>;

  /** Enable MMR diversity (default: true) */
  mmrEnabled: boolean;

  /** MMR config */
  mmrConfig: Partial<MMRConfig>;

  /** Maximum results to return */
  maxResults: number;

  /** Minimum score threshold */
  minScore: number;

  /** Maximum snippet length */
  maxSnippetLength: number;
}

/**
 * Default write pipeline config
 */
export const DEFAULT_WRITE_CONFIG: WritePipelineConfig = {
  autoChunk: true,
  chunkTokens: 400,
  overlapTokens: 80,
  autoEmbed: true,
  indexTranscripts: true,
  defaultTags: [],
  minContentLength: 20,
};

/**
 * Default read pipeline config
 */
export const DEFAULT_READ_CONFIG: ReadPipelineConfig = {
  hybridSearch: true,
  ftsWeight: 0.3,
  vectorWeight: 0.7,
  temporalDecay: true,
  temporalDecayConfig: {
    halfLifeDays: 30,
    minMultiplier: 0.1,
  },
  mmrEnabled: true,
  mmrConfig: {
    lambda: 0.7,
    duplicateThreshold: 0.8,
  },
  maxResults: 10,
  minScore: 0.1,
  maxSnippetLength: 300,
};

/**
 * Write operation input
 */
export interface WriteInput {
  /** Content type */
  type: 'event' | 'chunk' | 'transcript' | 'flush';

  /** Raw content */
  content: string | MemoryEvent | TranscriptChunk[] | FlushContent;

  /** Session ID */
  sessionId?: string;

  /** Additional tags */
  tags?: string[];

  /** Source information */
  source?: {
    type: string;
    id?: string;
  };

  /** Skip embedding generation */
  skipEmbed?: boolean;
}

/**
 * Write operation result
 */
export interface WriteResult {
  /** Success status */
  success: boolean;

  /** Written chunks */
  chunks: SemanticChunk[];

  /** Chunk count */
  chunkCount: number;

  /** Whether embeddings were generated */
  embeddingsGenerated: boolean;

  /** Duration in ms */
  durationMs: number;

  /** Errors if any */
  errors: Error[];
}

/**
 * Read operation input
 */
export interface ReadInput {
  /** Search query */
  query: string;

  /** Session ID filter */
  sessionId?: string;

  /** Tag filters */
  tags?: string[];

  /** Time range */
  since?: number;
  until?: number;

  /** Override max results */
  limit?: number;

  /** Include sources in results */
  includeSources?: boolean;
}

/**
 * Read operation result
 */
export interface ReadResult {
  /** Search results */
  results: Array<{
    chunk: SemanticChunk;
    score: number;
    matchType: 'fts' | 'vector' | 'hybrid';
    snippet: string;
    metadata: {
      originalScore?: number;
      decayedScore?: number;
      mmrScore?: number;
      ageInDays?: number;
    };
  }>;

  /** Total results before filtering */
  totalResults: number;

  /** Query time in ms */
  queryTimeMs: number;

  /** Search stages applied */
  stages: {
    fts: boolean;
    vector: boolean;
    temporalDecay: boolean;
    mmr: boolean;
  };
}

/**
 * Memory Pipeline stores
 */
export interface PipelineStores {
  eventStore: IEventStore;
  semanticStore: ISemanticStore;
  summaryStore: ISummaryStore;
  profileStore: IProfileStore;
}

/**
 * Memory Pipeline instance interface
 */
export interface IMemoryPipeline {
  /** Get write config */
  getWriteConfig(): WritePipelineConfig;

  /** Set write config */
  setWriteConfig(config: Partial<WritePipelineConfig>): void;

  /** Get read config */
  getReadConfig(): ReadPipelineConfig;

  /** Set read config */
  setReadConfig(config: Partial<ReadPipelineConfig>): void;

  /** Set embedding function */
  setEmbedFunction(fn: EmbedFunction): void;

  /** Check if embedding is available */
  hasEmbedding(): boolean;

  /**
   * Execute write pipeline
   * Content → Chunk → Embed → Store
   */
  write(input: WriteInput): Promise<WriteResult>;

  /**
   * Execute read pipeline
   * Query → Hybrid Search → Temporal Decay → MMR → Results
   */
  read(input: ReadInput): Promise<ReadResult>;

  /**
   * Write and read in one operation (useful for RAG)
   */
  writeAndRead(
    writeInput: WriteInput,
    readInput: ReadInput
  ): Promise<{ write: WriteResult; read: ReadResult }>;

  /**
   * Index a transcript
   */
  indexTranscript(transcript: ISessionTranscript): Promise<WriteResult>;

  /**
   * Process flush content and store
   */
  processFlush(content: FlushContent, sessionId?: string): Promise<WriteResult>;
}

/**
 * Estimate tokens from text
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Chunk text into smaller pieces
 */
function chunkText(
  text: string,
  maxTokens: number,
  overlap: number
): string[] {
  const chunks: string[] = [];
  const totalTokens = estimateTokens(text);

  if (totalTokens <= maxTokens) {
    return [text];
  }

  // Split by paragraphs first, then by sentences
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';
  let currentTokens = 0;

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);

    if (currentTokens + paraTokens > maxTokens && currentChunk) {
      chunks.push(currentChunk.trim());

      // Start new chunk with overlap
      const sentences = currentChunk.split(/[.!?]+\s+/);
      const overlapText = sentences.slice(-2).join('. ');
      currentChunk = overlapText + '\n\n' + para;
      currentTokens = estimateTokens(currentChunk);
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
      currentTokens += paraTokens;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Create snippet from text
 */
function createSnippet(text: string, query: string, maxLength: number): string {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  const matchIndex = lowerText.indexOf(lowerQuery);

  if (matchIndex === -1) {
    return text.length > maxLength
      ? text.slice(0, maxLength - 3) + '...'
      : text;
  }

  const contextBefore = Math.floor((maxLength - query.length) / 2);
  const start = Math.max(0, matchIndex - contextBefore);
  const end = Math.min(text.length, start + maxLength);

  let snippet = text.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  return snippet;
}

/**
 * Create a Memory Pipeline instance
 */
export function createMemoryPipeline(
  stores: PipelineStores,
  options?: {
    writeConfig?: Partial<WritePipelineConfig>;
    readConfig?: Partial<ReadPipelineConfig>;
    embedFunction?: EmbedFunction;
    transcriptIndexer?: ITranscriptIndexer;
    memoryFlush?: IMemoryFlush;
  }
): IMemoryPipeline {
  let writeConfig: WritePipelineConfig = { ...DEFAULT_WRITE_CONFIG, ...options?.writeConfig };
  let readConfig: ReadPipelineConfig = { ...DEFAULT_READ_CONFIG, ...options?.readConfig };
  let embedFunction: EmbedFunction | undefined = options?.embedFunction;

  const { semanticStore } = stores;

  return {
    getWriteConfig(): WritePipelineConfig {
      return { ...writeConfig };
    },

    setWriteConfig(config: Partial<WritePipelineConfig>): void {
      writeConfig = { ...writeConfig, ...config };
    },

    getReadConfig(): ReadPipelineConfig {
      return { ...readConfig };
    },

    setReadConfig(config: Partial<ReadPipelineConfig>): void {
      readConfig = { ...readConfig, ...config };
    },

    setEmbedFunction(fn: EmbedFunction): void {
      embedFunction = fn;
    },

    hasEmbedding(): boolean {
      return !!embedFunction;
    },

    async write(input: WriteInput): Promise<WriteResult> {
      const startTime = Date.now();
      const chunks: SemanticChunk[] = [];
      const errors: Error[] = [];
      let embeddingsGenerated = false;

      try {
        // Extract text content based on input type
        let texts: string[] = [];
        let tags = [...writeConfig.defaultTags, ...(input.tags || [])];

        if (input.type === 'event') {
          const event = input.content as MemoryEvent;
          const content = event.payload.content as string || event.summary;
          texts = writeConfig.autoChunk
            ? chunkText(content, writeConfig.chunkTokens, writeConfig.overlapTokens)
            : [content];
          tags.push(`event:${event.type}`);
        } else if (input.type === 'chunk') {
          texts = [input.content as string];
        } else if (input.type === 'transcript') {
          const transcriptChunks = input.content as TranscriptChunk[];
          texts = transcriptChunks.map((c) => c.text);
          tags.push('transcript');
        } else if (input.type === 'flush') {
          const flush = input.content as FlushContent;
          texts = flush.chunks.map((c) => c.text);
          tags.push('flush', 'compaction');
        }

        // Filter by minimum content length
        texts = texts.filter((t) => t.length >= writeConfig.minContentLength);

        // Generate embeddings and store
        for (const text of texts) {
          const chunkInput: SemanticChunkInput = {
            text,
            tags,
            sessionId: input.sessionId,
            sourceType: input.source?.type || input.type,
            sourceEventId: input.source?.id,
          };

          // Generate embedding if available and not skipped
          if (writeConfig.autoEmbed && embedFunction && !input.skipEmbed) {
            try {
              const embedding = await embedFunction(text);
              chunkInput.embedding = embedding;
              embeddingsGenerated = true;
            } catch (error) {
              errors.push(error as Error);
            }
          }

          const stored = await semanticStore.add(chunkInput);
          chunks.push(stored);
        }

        return {
          success: errors.length === 0,
          chunks,
          chunkCount: chunks.length,
          embeddingsGenerated,
          durationMs: Date.now() - startTime,
          errors,
        };
      } catch (error) {
        return {
          success: false,
          chunks,
          chunkCount: chunks.length,
          embeddingsGenerated,
          durationMs: Date.now() - startTime,
          errors: [...errors, error as Error],
        };
      }
    },

    async read(input: ReadInput): Promise<ReadResult> {
      const startTime = Date.now();
      const limit = input.limit ?? readConfig.maxResults;

      const stages = {
        fts: false,
        vector: false,
        temporalDecay: false,
        mmr: false,
      };

      try {
        // Execute hybrid search
        const searchResults = await semanticStore.search(input.query, {
          sessionId: input.sessionId,
          tags: input.tags,
          limit: limit * 3, // Get extra for post-processing
          useVector: readConfig.hybridSearch && !!embedFunction,
        });

        stages.fts = true;
        stages.vector = !!embedFunction;

        // Filter by time range
        let filtered = searchResults;
        if (input.since || input.until) {
          filtered = searchResults.filter((r) => {
            if (input.since && r.chunk.timestamp < input.since) return false;
            if (input.until && r.chunk.timestamp > input.until) return false;
            return true;
          });
        }

        // Filter by minimum score
        filtered = filtered.filter((r) => r.score >= readConfig.minScore);

        const totalResults = filtered.length;

        // Apply temporal decay
        let processed: SemanticSearchResult[] = filtered;
        if (readConfig.temporalDecay && filtered.length > 0) {
          const decayed = applyTemporalDecay(filtered, {
            ...readConfig.temporalDecayConfig,
            enabled: true,
          });
          processed = decayed;
          stages.temporalDecay = true;
        }

        // Apply MMR
        if (readConfig.mmrEnabled && processed.length > 0) {
          const mmrResults = applyMMR(processed, limit, {
            ...readConfig.mmrConfig,
            enabled: true,
          });
          processed = mmrResults;
          stages.mmr = true;
        }

        // Limit results
        processed = processed.slice(0, limit);

        // Build final results
        const results = processed.map((r) => {
          const decayed = r as DecayedSearchResult;
          const mmr = r as MMRSearchResult;

          return {
            chunk: r.chunk,
            score: r.score,
            matchType: r.matchType,
            snippet: createSnippet(r.chunk.text, input.query, readConfig.maxSnippetLength),
            metadata: {
              originalScore: decayed.originalScore,
              decayedScore: stages.temporalDecay ? r.score : undefined,
              mmrScore: mmr.mmrScore,
              ageInDays: decayed.ageInDays,
            },
          };
        });

        return {
          results,
          totalResults,
          queryTimeMs: Date.now() - startTime,
          stages,
        };
      } catch (error) {
        return {
          results: [],
          totalResults: 0,
          queryTimeMs: Date.now() - startTime,
          stages,
        };
      }
    },

    async writeAndRead(
      writeInput: WriteInput,
      readInput: ReadInput
    ): Promise<{ write: WriteResult; read: ReadResult }> {
      const write = await this.write(writeInput);
      const read = await this.read(readInput);
      return { write, read };
    },

    async indexTranscript(transcript: ISessionTranscript): Promise<WriteResult> {
      const chunks = transcript.generateChunks({
        maxTokensPerChunk: writeConfig.chunkTokens,
        overlapTokens: writeConfig.overlapTokens,
      });

      return this.write({
        type: 'transcript',
        content: chunks,
        sessionId: transcript.getMetadata().sessionId,
        tags: ['transcript', 'session'],
      });
    },

    async processFlush(content: FlushContent, sessionId?: string): Promise<WriteResult> {
      return this.write({
        type: 'flush',
        content,
        sessionId,
        tags: ['flush', 'compaction'],
      });
    },
  };
}
