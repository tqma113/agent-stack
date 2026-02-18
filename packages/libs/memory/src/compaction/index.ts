/**
 * @ai-stack/memory - Compaction Module
 *
 * Handles memory compaction and flushing when approaching context limits.
 */

export {
  createMemoryFlush,
  DEFAULT_MEMORY_FLUSH_CONFIG,
  DEFAULT_FLUSH_PROMPT,
  parseLLMFlushResponse,
  type MemoryFlushConfig,
  type FlushCheckResult,
  type FlushContent,
  type FlushResult,
  type FlushTriggerReason,
  type IMemoryFlush,
} from './memory-flush.js';

export {
  createCompactionManager,
  DEFAULT_COMPACTION_CONFIG,
  type CompactionConfig,
  type CompactionState,
  type CompactionResult,
  type ICompactionManager,
} from './compaction-manager.js';
