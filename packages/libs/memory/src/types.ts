/**
 * @agent-stack/memory - Type Definitions
 *
 * Core schema definitions for the memory system.
 * All memory layers share these fundamental types.
 */

// =============================================================================
// Common Types
// =============================================================================

/** Unique identifier */
export type UUID = string;

/** Unix timestamp in milliseconds */
export type Timestamp = number;

/** Confidence score (0-1) */
export type Confidence = number;

/** Token count */
export type TokenCount = number;

// =============================================================================
// Event Types (Episodic Memory)
// =============================================================================

/**
 * Event types that can be recorded in the event stream
 */
export type EventType =
  | 'USER_MSG' // User message input
  | 'ASSISTANT_MSG' // Assistant response
  | 'TOOL_CALL' // Tool invocation
  | 'TOOL_RESULT' // Tool execution result
  | 'DECISION' // Important decision made
  | 'STATE_CHANGE' // Task state transition
  | 'MEMORY_WRITE' // Memory write operation
  | 'MEMORY_READ' // Memory read operation
  | 'ERROR' // Error occurrence
  | 'SYSTEM'; // System event

/**
 * Entity extracted from an event
 */
export interface EventEntity {
  type: string; // e.g., 'file', 'function', 'variable', 'url'
  value: string;
  metadata?: Record<string, unknown>;
}

/**
 * Link to external resource
 */
export interface EventLink {
  type: 'file' | 'url' | 'event' | 'task' | 'custom';
  uri: string;
  label?: string;
}

/**
 * Event record in the episodic memory
 */
export interface MemoryEvent {
  /** Unique event ID */
  id: UUID;

  /** Timestamp when event occurred */
  timestamp: Timestamp;

  /** Event type classification */
  type: EventType;

  /** Session/conversation ID */
  sessionId?: string;

  /** Brief intent/purpose of the event */
  intent?: string;

  /** Extracted entities */
  entities: EventEntity[];

  /** One-line summary */
  summary: string;

  /** Full event payload (type-specific) */
  payload: Record<string, unknown>;

  /** Links to related resources */
  links: EventLink[];

  /** Parent event ID (for hierarchical events) */
  parentId?: UUID;

  /** Tags for categorization */
  tags: string[];
}

/**
 * Event creation input (without auto-generated fields)
 */
export type EventInput = Omit<MemoryEvent, 'id' | 'timestamp'> & {
  id?: UUID;
  timestamp?: Timestamp;
};

// =============================================================================
// Task State Types (Working Memory)
// =============================================================================

/**
 * Task status
 */
export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Constraint on task execution
 */
export interface TaskConstraint {
  id: string;
  type: 'must' | 'should' | 'must_not';
  description: string;
  source?: string; // Where this constraint came from
}

/**
 * Plan step
 */
export interface PlanStep {
  id: string;
  description: string;
  status: TaskStatus;
  dependencies?: string[]; // IDs of steps this depends on
  result?: string;
  actionId?: string; // For idempotency
  blockedBy?: string; // Reason if blocked
}

/**
 * Alias for PlanStep (used by StateReducer)
 */
export type TaskStep = PlanStep;

/**
 * Task state in working memory
 */
export interface TaskState {
  /** Task ID */
  id: UUID;

  /** Task goal/objective */
  goal: string;

  /** Current status */
  status: TaskStatus;

  /** Constraints to follow */
  constraints: TaskConstraint[];

  /** Planned steps */
  plan: PlanStep[];

  /** Completed step IDs */
  done: string[];

  /** Blocked step IDs (reasons stored in step.blockedBy) */
  blocked: string[];

  /** Next action to take */
  nextAction?: string;

  /** Last update timestamp */
  updatedAt: Timestamp;

  /** Version for optimistic locking */
  version: number;

  /** Session ID */
  sessionId?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task state update input
 */
export type TaskStateUpdate = Partial<Omit<TaskState, 'id' | 'version'>> & {
  actionId?: string; // For idempotency
};

/**
 * Task state snapshot for rollback
 */
export interface TaskStateSnapshot {
  taskId: UUID;
  version: number;
  state: TaskState;
  timestamp: Timestamp;
}

// =============================================================================
// Summary Types (Compressed Memory)
// =============================================================================

/**
 * Decision record in summary
 */
export interface SummaryDecision {
  description: string;
  reasoning?: string;
  timestamp: Timestamp;
  sourceEventId?: UUID;
}

/**
 * Todo item in summary
 */
export interface SummaryTodo {
  description: string;
  priority?: 'high' | 'medium' | 'low';
  dueDate?: Timestamp;
  completed: boolean;
}

/**
 * Rolling summary of conversation/task
 */
export interface Summary {
  /** Summary ID */
  id: UUID;

  /** Timestamp when summary was created */
  timestamp: Timestamp;

  /** Session/conversation ID */
  sessionId: string;

  /** One-line summary */
  short: string;

  /** Bullet points of key information */
  bullets: string[];

  /** Important decisions made */
  decisions: SummaryDecision[];

  /** Outstanding todos */
  todos: SummaryTodo[];

  /** Event IDs covered by this summary */
  coveredEventIds: UUID[];

  /** Token count of this summary */
  tokenCount?: TokenCount;
}

/**
 * Summary creation input
 */
export type SummaryInput = Omit<Summary, 'id' | 'timestamp'>;

// =============================================================================
// Profile Types (User Preferences)
// =============================================================================

/**
 * Conflict resolution strategy for profile values
 */
export type ConflictStrategy = 'latest' | 'confidence' | 'explicit' | 'manual';

/**
 * Profile item (key-value preference)
 */
export interface ProfileItem {
  /** Profile key (e.g., 'language', 'tone', 'format') */
  key: string;

  /** Profile value */
  value: unknown;

  /** Last update timestamp */
  updatedAt: Timestamp;

  /** Confidence score */
  confidence: Confidence;

  /** Source event ID (for traceability) */
  sourceEventId?: UUID;

  /** Whether explicitly set by user */
  explicit: boolean;

  /** Optional expiration timestamp */
  expiresAt?: Timestamp;
}

/**
 * Profile item input
 */
export type ProfileItemInput = Omit<ProfileItem, 'updatedAt'>;

/**
 * Allowed profile keys (whitelist)
 */
export const PROFILE_KEYS = [
  'language', // Preferred language
  'tone', // Communication tone
  'format', // Output format preference
  'verbosity', // Response length preference
  'code_style', // Code style preferences
  'timezone', // User timezone
  'units', // Unit system (metric/imperial)
  'restrictions', // Content restrictions
  'expertise_level', // Technical expertise level
  'custom', // Custom preferences (nested object)
] as const;

export type ProfileKey = (typeof PROFILE_KEYS)[number];

// =============================================================================
// Semantic Memory Types (Searchable Content)
// =============================================================================

/**
 * Semantic chunk for retrieval
 */
export interface SemanticChunk {
  /** Chunk ID */
  id: UUID;

  /** Creation timestamp */
  timestamp: Timestamp;

  /** Text content */
  text: string;

  /** Tags for filtering */
  tags: string[];

  /** Source event ID */
  sourceEventId?: UUID;

  /** Source type (e.g., 'conversation', 'document', 'tool_result') */
  sourceType?: string;

  /** Session ID */
  sessionId?: string;

  /** Embedding vector (if using vector search) */
  embedding?: number[];

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Semantic chunk input
 */
export type SemanticChunkInput = Omit<SemanticChunk, 'id' | 'timestamp'>;

/**
 * Search result with relevance score
 */
/**
 * Match type for search results
 */
export type SemanticMatchType = 'fts' | 'vector' | 'hybrid';

/**
 * Search result with relevance score
 */
export interface SemanticSearchResult {
  chunk: SemanticChunk;
  score: number;
  matchType: SemanticMatchType;
}

// =============================================================================
// Memory Bundle (Retrieved Memory Package)
// =============================================================================

/**
 * Warning about memory state
 */
export interface MemoryWarning {
  type: 'conflict' | 'stale' | 'incomplete' | 'overflow' | 'custom';
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Memory bundle - packaged memory for injection
 */
export interface MemoryBundle {
  /** Profile items (highest priority) */
  profile: ProfileItem[];

  /** Current task state */
  taskState?: TaskState;

  /** Recent relevant events */
  recentEvents: MemoryEvent[];

  /** Retrieved semantic chunks */
  retrievedChunks: SemanticSearchResult[];

  /** Latest summary */
  summary?: Summary;

  /** Warnings about memory state */
  warnings: MemoryWarning[];

  /** Total token count of this bundle */
  totalTokens: TokenCount;

  /** Timestamp when bundle was created */
  timestamp: Timestamp;
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Token budget configuration
 */
export interface TokenBudget {
  profile: TokenCount;
  taskState: TokenCount;
  recentEvents: TokenCount;
  semanticChunks: TokenCount;
  summary: TokenCount;
  total: TokenCount;
}

/**
 * Default token budget
 */
export const DEFAULT_TOKEN_BUDGET: TokenBudget = {
  profile: 200,
  taskState: 300,
  recentEvents: 500,
  semanticChunks: 800,
  summary: 400,
  total: 2200,
};

/**
 * Write policy configuration
 */
export interface WritePolicyConfig {
  /** Minimum confidence to write to long-term memory */
  minConfidence: Confidence;

  /** Enable automatic summarization */
  autoSummarize: boolean;

  /** Summarize every N events */
  summarizeEveryNEvents: number;

  /** Summarize when tokens exceed threshold */
  summarizeTokenThreshold: TokenCount;

  /** Profile key whitelist (null = allow all) */
  profileKeyWhitelist: ProfileKey[] | null;

  /** Conflict resolution strategy */
  conflictStrategy: ConflictStrategy;

  /** Time decay factor (0-1, lower = faster decay) */
  timeDecayFactor: number;

  /** Stale threshold in milliseconds */
  staleThresholdMs: number;
}

/**
 * Default write policy
 */
export const DEFAULT_WRITE_POLICY: WritePolicyConfig = {
  minConfidence: 0.5,
  autoSummarize: true,
  summarizeEveryNEvents: 20,
  summarizeTokenThreshold: 4000,
  profileKeyWhitelist: [...PROFILE_KEYS],
  conflictStrategy: 'latest',
  timeDecayFactor: 0.9,
  staleThresholdMs: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Retrieval configuration
 */
export interface RetrievalConfig {
  /** Maximum recent events to retrieve */
  maxRecentEvents: number;

  /** Maximum semantic chunks to retrieve */
  maxSemanticChunks: number;

  /** Time window for recent events (ms) */
  recentEventsWindowMs: number;

  /** Enable semantic search */
  enableSemanticSearch: boolean;

  /** Enable FTS search */
  enableFtsSearch: boolean;

  /** Rerank results */
  enableRerank: boolean;
}

/**
 * Default retrieval config
 */
export const DEFAULT_RETRIEVAL_CONFIG: RetrievalConfig = {
  maxRecentEvents: 10,
  maxSemanticChunks: 5,
  recentEventsWindowMs: 30 * 60 * 1000, // 30 minutes
  enableSemanticSearch: true,
  enableFtsSearch: true,
  enableRerank: true,
};

/**
 * Memory manager configuration
 */
export interface MemoryConfig {
  /** Database file path (SQLite) */
  dbPath: string;

  /** Token budget */
  tokenBudget: TokenBudget;

  /** Write policy */
  writePolicy: WritePolicyConfig;

  /** Retrieval config */
  retrieval: RetrievalConfig;

  /** Enable debug logging */
  debug: boolean;
}

/**
 * Default memory config
 */
export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  dbPath: '.agent-stack/memory.db',
  tokenBudget: DEFAULT_TOKEN_BUDGET,
  writePolicy: DEFAULT_WRITE_POLICY,
  retrieval: DEFAULT_RETRIEVAL_CONFIG,
  debug: false,
};

// =============================================================================
// Store Interfaces
// =============================================================================

/**
 * Base store interface
 */
export interface BaseStore {
  /** Initialize the store */
  initialize(): Promise<void>;

  /** Close the store */
  close(): Promise<void>;

  /** Clear all data */
  clear(): Promise<void>;
}

/**
 * Event store interface
 */
export interface IEventStore extends BaseStore {
  /** Add an event */
  add(event: EventInput): Promise<MemoryEvent>;

  /** Add multiple events in a single transaction (batch insert) */
  addBatch(events: EventInput[]): Promise<MemoryEvent[]>;

  /** Get event by ID */
  get(id: UUID): Promise<MemoryEvent | null>;

  /** Query events */
  query(options: {
    sessionId?: string;
    types?: EventType[];
    since?: Timestamp;
    until?: Timestamp;
    limit?: number;
    offset?: number;
    tags?: string[];
  }): Promise<MemoryEvent[]>;

  /** Get recent events */
  getRecent(limit: number, sessionId?: string): Promise<MemoryEvent[]>;

  /** Count events */
  count(sessionId?: string): Promise<number>;

  /** Delete event by ID */
  delete(id: UUID): Promise<boolean>;

  /** Delete multiple events by IDs */
  deleteBatch(ids: UUID[]): Promise<number>;

  /** Delete events by session ID */
  deleteBySession(sessionId: string): Promise<number>;

  /** Delete events older than a timestamp */
  deleteBeforeTimestamp(timestamp: Timestamp): Promise<number>;
}

/**
 * Task state store interface
 */
export interface ITaskStateStore extends BaseStore {
  /** Create a new task */
  create(task: Omit<TaskState, 'id' | 'version' | 'updatedAt'>): Promise<TaskState>;

  /** Get task by ID */
  get(id: UUID): Promise<TaskState | null>;

  /** Update task state */
  update(id: UUID, update: TaskStateUpdate): Promise<TaskState>;

  /** Get current/active task */
  getCurrent(sessionId?: string): Promise<TaskState | null>;

  /** List tasks */
  list(options?: {
    sessionId?: string;
    status?: TaskStatus[];
    limit?: number;
  }): Promise<TaskState[]>;

  /** Create snapshot for rollback */
  snapshot(id: UUID): Promise<TaskStateSnapshot>;

  /** Rollback to snapshot */
  rollback(taskId: UUID, version: number): Promise<TaskState>;

  /** Get snapshots */
  getSnapshots(taskId: UUID, limit?: number): Promise<TaskStateSnapshot[]>;
}

/**
 * Summary store interface
 */
export interface ISummaryStore extends BaseStore {
  /** Add a summary */
  add(summary: SummaryInput): Promise<Summary>;

  /** Get summary by ID */
  get(id: UUID): Promise<Summary | null>;

  /** Get latest summary for session */
  getLatest(sessionId: string): Promise<Summary | null>;

  /** List summaries */
  list(options?: {
    sessionId?: string;
    since?: Timestamp;
    limit?: number;
  }): Promise<Summary[]>;
}

/**
 * Profile store interface
 */
export interface IProfileStore extends BaseStore {
  /** Set a profile item */
  set(item: ProfileItemInput): Promise<ProfileItem>;

  /** Get a profile item */
  get(key: string): Promise<ProfileItem | null>;

  /** Get all profile items */
  getAll(): Promise<ProfileItem[]>;

  /** Delete a profile item */
  delete(key: string): Promise<boolean>;

  /** Check if key exists */
  has(key: string): Promise<boolean>;

  /** Get items by source event */
  getBySourceEvent(eventId: UUID): Promise<ProfileItem[]>;
}

/**
 * Semantic store interface
 */
export interface ISemanticStore extends BaseStore {
  /** Add a chunk */
  add(chunk: SemanticChunkInput): Promise<SemanticChunk>;

  /** Get chunk by ID */
  get(id: UUID): Promise<SemanticChunk | null>;

  /** Full-text search */
  searchFts(
    query: string,
    options?: {
      tags?: string[];
      sessionId?: string;
      limit?: number;
    }
  ): Promise<SemanticSearchResult[]>;

  /** Vector search (if enabled) */
  searchVector(
    embedding: number[],
    options?: {
      tags?: string[];
      sessionId?: string;
      limit?: number;
    }
  ): Promise<SemanticSearchResult[]>;

  /** Hybrid search */
  search(
    query: string,
    options?: {
      tags?: string[];
      sessionId?: string;
      limit?: number;
      useVector?: boolean;
    }
  ): Promise<SemanticSearchResult[]>;

  /** Delete chunks by session */
  deleteBySession(sessionId: string): Promise<number>;
}

// =============================================================================
// Manager Interfaces
// =============================================================================

/**
 * Observer callback
 */
export type ObserverCallback = (event: MemoryEvent) => void | Promise<void>;

/**
 * Memory manager interface
 */
export interface IMemoryManager {
  /** Initialize the manager */
  initialize(): Promise<void>;

  /** Close the manager */
  close(): Promise<void>;

  // Event operations
  /** Record an event */
  recordEvent(event: EventInput): Promise<MemoryEvent>;

  /** Subscribe to events */
  onEvent(callback: ObserverCallback): () => void;

  // Task operations
  /** Create a task */
  createTask(task: Omit<TaskState, 'id' | 'version' | 'updatedAt'>): Promise<TaskState>;

  /** Update task state */
  updateTask(id: UUID, update: TaskStateUpdate): Promise<TaskState>;

  /** Get current task */
  getCurrentTask(sessionId?: string): Promise<TaskState | null>;

  // Profile operations
  /** Set profile item */
  setProfile(item: ProfileItemInput): Promise<ProfileItem>;

  /** Get profile item */
  getProfile(key: string): Promise<ProfileItem | null>;

  /** Get all profile items */
  getAllProfiles(): Promise<ProfileItem[]>;

  // Retrieval
  /** Retrieve memory bundle */
  retrieve(options?: {
    sessionId?: string;
    query?: string;
    taskId?: UUID;
  }): Promise<MemoryBundle>;

  // Summary
  /** Generate summary */
  summarize(sessionId: string): Promise<Summary>;

  // Semantic
  /** Add semantic chunk */
  addChunk(chunk: SemanticChunkInput): Promise<SemanticChunk>;

  /** Search semantic memory */
  searchChunks(
    query: string,
    options?: {
      tags?: string[];
      sessionId?: string;
      limit?: number;
    }
  ): Promise<SemanticSearchResult[]>;
}
