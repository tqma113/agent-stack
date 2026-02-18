/**
 * @agent-stack/memory - Session Transcript
 *
 * Stores and indexes session transcripts for searchability.
 * Sessions are stored as JSONL files and indexed into semantic memory.
 */

import type { MemoryEvent, EventType } from '@agent-stack/memory-store-sqlite';

/**
 * Transcript entry (single line in JSONL)
 */
export interface TranscriptEntry {
  /** Entry type */
  type: 'message' | 'tool' | 'decision' | 'system';

  /** Timestamp */
  timestamp: number;

  /** Message content */
  message: {
    role: 'user' | 'assistant' | 'tool' | 'system';
    content: string | TranscriptContent[];
    name?: string; // Tool name for tool messages
  };

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Transcript content (supports multi-part messages)
 */
export interface TranscriptContent {
  type: 'text' | 'image' | 'tool_use' | 'tool_result';
  text?: string;
  data?: string;
  tool_use_id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

/**
 * Transcript session metadata
 */
export interface TranscriptMetadata {
  /** Session ID */
  sessionId: string;

  /** Session title/topic (auto-generated or user-set) */
  title?: string;

  /** Creation timestamp */
  createdAt: number;

  /** Last update timestamp */
  updatedAt: number;

  /** Entry count */
  entryCount: number;

  /** Estimated tokens */
  estimatedTokens: number;

  /** Tags */
  tags: string[];

  /** Whether session is active */
  active: boolean;
}

/**
 * Transcript search options
 */
export interface TranscriptSearchOptions {
  /** Session IDs to search (empty = all) */
  sessionIds?: string[];

  /** Roles to include */
  roles?: Array<'user' | 'assistant' | 'tool' | 'system'>;

  /** Time range */
  since?: number;
  until?: number;

  /** Maximum results */
  limit?: number;

  /** Include metadata */
  includeMetadata?: boolean;
}

/**
 * Transcript search result
 */
export interface TranscriptSearchResult {
  /** Session ID */
  sessionId: string;

  /** Entry */
  entry: TranscriptEntry;

  /** Match score */
  score: number;

  /** Snippet (highlighted match) */
  snippet: string;

  /** Line number in transcript */
  lineNumber: number;
}

/**
 * Chunk for indexing
 */
export interface TranscriptChunk {
  /** Session ID */
  sessionId: string;

  /** Text content */
  text: string;

  /** Start line in transcript */
  startLine: number;

  /** End line in transcript */
  endLine: number;

  /** Timestamp range */
  timestampStart: number;
  timestampEnd: number;

  /** Roles included in chunk */
  roles: string[];

  /** Source type */
  sourceType: 'transcript';
}

/**
 * Session Transcript instance interface
 */
export interface ISessionTranscript {
  /** Get session metadata */
  getMetadata(): TranscriptMetadata;

  /** Update metadata */
  updateMetadata(updates: Partial<TranscriptMetadata>): void;

  /** Append an entry */
  append(entry: TranscriptEntry): void;

  /** Append from MemoryEvent */
  appendFromEvent(event: MemoryEvent): void;

  /** Get all entries */
  getEntries(): TranscriptEntry[];

  /** Get entries in time range */
  getEntriesInRange(since: number, until?: number): TranscriptEntry[];

  /** Serialize to JSONL string */
  toJSONL(): string;

  /** Parse from JSONL string */
  fromJSONL(jsonl: string): void;

  /** Clear all entries */
  clear(): void;

  /** Generate chunks for indexing */
  generateChunks(options?: {
    maxTokensPerChunk?: number;
    overlapTokens?: number;
  }): TranscriptChunk[];

  /** Generate title from content (for new sessions) */
  generateTitle(): string;

  /** Get token estimate */
  estimateTokens(): number;
}

/**
 * Estimate tokens from text (roughly 4 chars per token)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Convert MemoryEvent type to transcript entry type
 */
function eventTypeToEntryType(type: EventType): TranscriptEntry['type'] {
  switch (type) {
    case 'USER_MSG':
    case 'ASSISTANT_MSG':
      return 'message';
    case 'TOOL_CALL':
    case 'TOOL_RESULT':
      return 'tool';
    case 'DECISION':
      return 'decision';
    default:
      return 'system';
  }
}

/**
 * Convert MemoryEvent type to role
 */
function eventTypeToRole(type: EventType): TranscriptEntry['message']['role'] {
  switch (type) {
    case 'USER_MSG':
      return 'user';
    case 'ASSISTANT_MSG':
      return 'assistant';
    case 'TOOL_CALL':
    case 'TOOL_RESULT':
      return 'tool';
    default:
      return 'system';
  }
}

/**
 * Extract content from MemoryEvent
 */
function extractContent(event: MemoryEvent): string {
  const payload = event.payload;

  if (typeof payload.content === 'string') {
    return payload.content;
  }

  if (typeof payload.result === 'string') {
    return payload.result;
  }

  if (payload.decision) {
    return String(payload.decision);
  }

  return event.summary;
}

/**
 * Create a Session Transcript instance
 */
export function createSessionTranscript(
  sessionId: string,
  initialMetadata?: Partial<TranscriptMetadata>
): ISessionTranscript {
  const now = Date.now();
  const entries: TranscriptEntry[] = [];

  let metadata: TranscriptMetadata = {
    sessionId,
    title: initialMetadata?.title,
    createdAt: initialMetadata?.createdAt ?? now,
    updatedAt: initialMetadata?.updatedAt ?? now,
    entryCount: 0,
    estimatedTokens: 0,
    tags: initialMetadata?.tags ?? [],
    active: initialMetadata?.active ?? true,
  };

  return {
    getMetadata(): TranscriptMetadata {
      return { ...metadata };
    },

    updateMetadata(updates: Partial<TranscriptMetadata>): void {
      metadata = { ...metadata, ...updates, updatedAt: Date.now() };
    },

    append(entry: TranscriptEntry): void {
      entries.push(entry);
      metadata.entryCount = entries.length;
      metadata.updatedAt = Date.now();

      // Update token estimate
      const content = typeof entry.message.content === 'string'
        ? entry.message.content
        : entry.message.content.map((c) => c.text || '').join(' ');
      metadata.estimatedTokens += estimateTokens(content);
    },

    appendFromEvent(event: MemoryEvent): void {
      const entry: TranscriptEntry = {
        type: eventTypeToEntryType(event.type),
        timestamp: event.timestamp,
        message: {
          role: eventTypeToRole(event.type),
          content: extractContent(event),
          name: event.payload.toolName as string | undefined,
        },
        metadata: {
          eventId: event.id,
          eventType: event.type,
          tags: event.tags,
        },
      };

      this.append(entry);
    },

    getEntries(): TranscriptEntry[] {
      return [...entries];
    },

    getEntriesInRange(since: number, until?: number): TranscriptEntry[] {
      return entries.filter((e) => {
        if (e.timestamp < since) return false;
        if (until && e.timestamp > until) return false;
        return true;
      });
    },

    toJSONL(): string {
      return entries.map((e) => JSON.stringify(e)).join('\n');
    },

    fromJSONL(jsonl: string): void {
      entries.length = 0;
      metadata.estimatedTokens = 0;

      const lines = jsonl.split('\n').filter((l) => l.trim());
      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as TranscriptEntry;
          entries.push(entry);

          const content = typeof entry.message.content === 'string'
            ? entry.message.content
            : entry.message.content.map((c) => c.text || '').join(' ');
          metadata.estimatedTokens += estimateTokens(content);
        } catch {
          console.warn('[SessionTranscript] Failed to parse line:', line.slice(0, 50));
        }
      }

      metadata.entryCount = entries.length;
      if (entries.length > 0) {
        metadata.createdAt = entries[0].timestamp;
        metadata.updatedAt = entries[entries.length - 1].timestamp;
      }
    },

    clear(): void {
      entries.length = 0;
      metadata.entryCount = 0;
      metadata.estimatedTokens = 0;
      metadata.updatedAt = Date.now();
    },

    generateChunks(options?: {
      maxTokensPerChunk?: number;
      overlapTokens?: number;
    }): TranscriptChunk[] {
      const maxTokens = options?.maxTokensPerChunk ?? 400;
      const overlap = options?.overlapTokens ?? 80;
      const chunks: TranscriptChunk[] = [];

      if (entries.length === 0) return chunks;

      let currentChunk: TranscriptEntry[] = [];
      let currentTokens = 0;
      let startLine = 0;

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const content = typeof entry.message.content === 'string'
          ? entry.message.content
          : entry.message.content.map((c) => c.text || '').join(' ');
        const entryTokens = estimateTokens(content);

        if (currentTokens + entryTokens > maxTokens && currentChunk.length > 0) {
          // Create chunk
          chunks.push(createChunkFromEntries(
            metadata.sessionId,
            currentChunk,
            startLine,
            startLine + currentChunk.length - 1
          ));

          // Start new chunk with overlap
          const overlapEntries: TranscriptEntry[] = [];
          let overlapTokens = 0;
          for (let j = currentChunk.length - 1; j >= 0 && overlapTokens < overlap; j--) {
            const e = currentChunk[j];
            const c = typeof e.message.content === 'string'
              ? e.message.content
              : e.message.content.map((ct) => ct.text || '').join(' ');
            overlapTokens += estimateTokens(c);
            overlapEntries.unshift(e);
          }

          currentChunk = overlapEntries;
          currentTokens = overlapTokens;
          startLine = i - overlapEntries.length + 1;
        }

        currentChunk.push(entry);
        currentTokens += entryTokens;
      }

      // Add final chunk
      if (currentChunk.length > 0) {
        chunks.push(createChunkFromEntries(
          metadata.sessionId,
          currentChunk,
          startLine,
          entries.length - 1
        ));
      }

      return chunks;
    },

    generateTitle(): string {
      // Find first significant user message
      const userMsgs = entries.filter((e) =>
        e.message.role === 'user' &&
        typeof e.message.content === 'string' &&
        e.message.content.length > 10
      );

      if (userMsgs.length === 0) {
        return `Session ${metadata.sessionId.slice(0, 8)}`;
      }

      const firstMsg = userMsgs[0].message.content as string;
      // Take first sentence or first 50 chars
      const title = firstMsg.split(/[.!?\n]/)[0].trim();
      return title.length > 50 ? title.slice(0, 47) + '...' : title;
    },

    estimateTokens(): number {
      return metadata.estimatedTokens;
    },
  };
}

/**
 * Create chunk from entries
 */
function createChunkFromEntries(
  sessionId: string,
  entries: TranscriptEntry[],
  startLine: number,
  endLine: number
): TranscriptChunk {
  const texts: string[] = [];
  const roles = new Set<string>();
  let timestampStart = Infinity;
  let timestampEnd = 0;

  for (const entry of entries) {
    const content = typeof entry.message.content === 'string'
      ? entry.message.content
      : entry.message.content.map((c) => c.text || '').join(' ');

    texts.push(`[${entry.message.role}]: ${content}`);
    roles.add(entry.message.role);

    if (entry.timestamp < timestampStart) timestampStart = entry.timestamp;
    if (entry.timestamp > timestampEnd) timestampEnd = entry.timestamp;
  }

  return {
    sessionId,
    text: texts.join('\n'),
    startLine,
    endLine,
    timestampStart,
    timestampEnd,
    roles: Array.from(roles),
    sourceType: 'transcript',
  };
}

/**
 * Format transcript for display
 */
export function formatTranscript(
  entries: TranscriptEntry[],
  options?: {
    includeTimestamps?: boolean;
    maxLength?: number;
  }
): string {
  const includeTimestamps = options?.includeTimestamps ?? false;
  const maxLength = options?.maxLength ?? 10000;

  const lines: string[] = [];
  let totalLength = 0;

  for (const entry of entries) {
    const role = entry.message.role.toUpperCase();
    const content = typeof entry.message.content === 'string'
      ? entry.message.content
      : entry.message.content.map((c) => c.text || '').join(' ');

    let line = `[${role}]: ${content}`;
    if (includeTimestamps) {
      const date = new Date(entry.timestamp).toISOString();
      line = `[${date}] ${line}`;
    }

    if (totalLength + line.length > maxLength) {
      lines.push('... (truncated)');
      break;
    }

    lines.push(line);
    totalLength += line.length + 1;
  }

  return lines.join('\n');
}
