/**
 * @ai-stack/assistant - Core Types
 */

// ============================================
// Assistant Configuration
// ============================================

/**
 * Main configuration for the Assistant
 */
export interface AssistantConfig {
  /** Assistant name */
  name?: string;
  /** Base directory for assistant data (default: ~/.ai-assistant) */
  baseDir?: string;
  /** Agent configuration */
  agent?: AgentConfigSection;
  /** Markdown memory configuration */
  memory?: MarkdownMemoryConfig;
  /** Multi-channel gateway configuration */
  gateway?: GatewayConfig;
  /** Scheduler configuration */
  scheduler?: SchedulerConfig;
}

/**
 * Agent configuration section
 */
export interface AgentConfigSection {
  /** LLM model to use */
  model?: string;
  /** Temperature for response generation */
  temperature?: number;
  /** Maximum tokens in response */
  maxTokens?: number;
  /** System prompt for the agent */
  systemPrompt?: string;
  /** OpenAI API key (prefer env var OPENAI_API_KEY) */
  apiKey?: string;
  /** Custom API base URL */
  baseURL?: string;
  /** MCP configuration */
  mcp?: {
    configPath?: string;
    autoConnect?: boolean;
  };
  /** Skill configuration */
  skill?: {
    directories?: string[];
    autoLoad?: boolean;
  };
}

// ============================================
// Markdown Memory Types
// ============================================

/**
 * Markdown memory configuration
 */
export interface MarkdownMemoryConfig {
  /** Enable memory system */
  enabled?: boolean;
  /** Path to MEMORY.md file (default: baseDir/MEMORY.md) */
  memoryFile?: string;
  /** Directory for daily logs (default: baseDir/memory) */
  logsDir?: string;
  /** SQLite database path for derived index (default: baseDir/index.db) */
  dbPath?: string;
  /** Sync on startup */
  syncOnStartup?: boolean;
  /** Watch for file changes */
  watchFiles?: boolean;
  /** Embedding model for semantic search */
  embeddingModel?: string;
}

/**
 * Parsed MEMORY.md structure
 */
export interface MemoryDocument {
  /** User profile information */
  profile: ProfileSection;
  /** Known facts about user */
  facts: FactItem[];
  /** Todo items */
  todos: TodoItem[];
  /** Free-form notes */
  notes: string;
  /** Raw frontmatter metadata */
  metadata: Record<string, unknown>;
}

/**
 * Profile section from MEMORY.md
 */
export interface ProfileSection {
  name?: string;
  timezone?: string;
  language?: string;
  [key: string]: unknown;
}

/**
 * A fact item from the Facts section
 */
export interface FactItem {
  id: string;
  content: string;
  confidence?: number;
  source?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * A todo item from the Todos section
 */
export interface TodoItem {
  id: string;
  content: string;
  completed: boolean;
  priority?: 'high' | 'medium' | 'low';
  dueDate?: Date;
  createdAt?: Date;
}

/**
 * Daily log entry
 */
export interface DailyLogEntry {
  timestamp: Date;
  type: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * Daily log file structure
 */
export interface DailyLog {
  date: string; // YYYY-MM-DD
  entries: DailyLogEntry[];
}

// ============================================
// Gateway Types
// ============================================

/**
 * Gateway configuration
 */
export interface GatewayConfig {
  /** Session isolation strategy */
  sessionStrategy?: SessionStrategy;
  /** Channel configurations */
  channels?: ChannelConfigs;
}

/**
 * Session isolation strategy
 */
export type SessionStrategy = 'per-peer' | 'per-channel' | 'global';

/**
 * Channel configurations
 */
export interface ChannelConfigs {
  /** CLI channel config */
  cli?: CLIChannelConfig;
  /** Telegram channel config */
  telegram?: TelegramChannelConfig;
  /** Discord channel config */
  discord?: DiscordChannelConfig;
  /** WhatsApp channel config */
  whatsapp?: WhatsAppChannelConfig;
}

/**
 * Base channel configuration
 */
export interface BaseChannelConfig {
  /** Enable this channel */
  enabled?: boolean;
}

/**
 * CLI channel configuration
 */
export interface CLIChannelConfig extends BaseChannelConfig {
  /** Prompt prefix */
  prompt?: string;
}

/**
 * Telegram channel configuration
 */
export interface TelegramChannelConfig extends BaseChannelConfig {
  /** Bot token (or use env TELEGRAM_BOT_TOKEN) */
  token?: string;
  /** Allowed user IDs (empty = allow all) */
  allowedUsers?: number[];
}

/**
 * Discord channel configuration
 */
export interface DiscordChannelConfig extends BaseChannelConfig {
  /** Bot token (or use env DISCORD_BOT_TOKEN) */
  token?: string;
  /** Allowed guild IDs */
  allowedGuilds?: string[];
  /** Allowed channel IDs */
  allowedChannels?: string[];
}

/**
 * WhatsApp channel configuration
 */
export interface WhatsAppChannelConfig extends BaseChannelConfig {
  /** Session data path */
  sessionPath?: string;
  /** Allowed phone numbers */
  allowedNumbers?: string[];
}

/**
 * Incoming message from any channel
 */
export interface IncomingMessage {
  /** Unique message ID */
  id: string;
  /** Channel type */
  channel: ChannelType;
  /** Peer ID (user or chat ID) */
  peerId: string;
  /** Message content */
  content: MessageContent;
  /** Original timestamp */
  timestamp: Date;
  /** Raw platform-specific data */
  raw?: unknown;
}

/**
 * Channel type enum
 */
export type ChannelType = 'cli' | 'telegram' | 'discord' | 'whatsapp';

/**
 * Message content (text or multimedia)
 */
export interface MessageContent {
  /** Text content */
  text?: string;
  /** Image URLs or paths */
  images?: string[];
  /** File attachments */
  files?: FileAttachment[];
}

/**
 * File attachment
 */
export interface FileAttachment {
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
}

/**
 * Session data
 */
export interface Session {
  /** Session ID */
  id: string;
  /** Channel type */
  channel: ChannelType;
  /** Peer ID */
  peerId: string;
  /** Created timestamp */
  createdAt: Date;
  /** Last activity timestamp */
  lastActivityAt: Date;
  /** Custom session data */
  data?: Record<string, unknown>;
}

// ============================================
// Scheduler Types
// ============================================

/**
 * Scheduler configuration
 */
export interface SchedulerConfig {
  /** Enable scheduler */
  enabled?: boolean;
  /** Allow agent to control scheduler */
  allowAgentControl?: boolean;
  /** Persistence file path */
  persistencePath?: string;
}

/**
 * Job types
 */
export type JobType = 'cron' | 'reminder' | 'interval' | 'watcher';

/**
 * Scheduled job definition
 */
export interface Job {
  /** Unique job ID */
  id: string;
  /** Job name */
  name: string;
  /** Job type */
  type: JobType;
  /** Is job enabled */
  enabled: boolean;
  /** Schedule configuration */
  schedule: JobSchedule;
  /** Execution configuration */
  execution: JobExecution;
  /** Delivery configuration */
  delivery: JobDelivery;
  /** Created timestamp */
  createdAt: Date;
  /** Last run timestamp */
  lastRunAt?: Date;
  /** Next run timestamp */
  nextRunAt?: Date;
}

/**
 * Job schedule (union type for different job types)
 */
export type JobSchedule = CronSchedule | ReminderSchedule | IntervalSchedule | WatcherSchedule;

/**
 * Cron schedule
 */
export interface CronSchedule {
  type: 'cron';
  /** Cron expression (e.g., "0 9 * * *") */
  expression: string;
  /** Timezone */
  timezone?: string;
}

/**
 * Reminder schedule (one-time)
 */
export interface ReminderSchedule {
  type: 'reminder';
  /** When to trigger */
  triggerAt: Date;
  /** Original reminder text */
  reminderText?: string;
}

/**
 * Interval schedule (recurring)
 */
export interface IntervalSchedule {
  type: 'interval';
  /** Interval in milliseconds */
  intervalMs: number;
  /** Start immediately */
  immediate?: boolean;
}

/**
 * Watcher schedule (file/event based)
 */
export interface WatcherSchedule {
  type: 'watcher';
  /** Watch patterns */
  patterns: string[];
  /** Debounce interval */
  debounceMs?: number;
}

/**
 * Job execution configuration
 */
export interface JobExecution {
  /** Execution mode */
  mode: 'agent' | 'tool' | 'template';
  /** Prompt for agent mode */
  prompt?: string;
  /** Tool configuration for tool mode */
  tool?: {
    name: string;
    args: Record<string, unknown>;
  };
  /** Template for template mode */
  template?: string;
}

/**
 * Job delivery configuration
 */
export interface JobDelivery {
  /** Channels to deliver to */
  channels: string[];
  /** Silent delivery (no notification) */
  silent?: boolean;
  /** Specific peer IDs to deliver to */
  peerIds?: string[];
}

/**
 * Job run result
 */
export interface JobRunResult {
  jobId: string;
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
  timestamp: Date;
}

// ============================================
// Daemon Types
// ============================================

/**
 * Daemon status
 */
export interface DaemonStatus {
  /** Is daemon running */
  running: boolean;
  /** Process ID */
  pid?: number;
  /** Uptime in seconds */
  uptime?: number;
  /** Started at */
  startedAt?: Date;
  /** Connected channels */
  connectedChannels?: string[];
  /** Active jobs */
  activeJobs?: number;
  /** Last health check */
  lastHealthCheck?: Date;
}

// ============================================
// Channel Adapter Interface
// ============================================

/**
 * Channel adapter interface
 */
export interface IChannelAdapter {
  /** Adapter name */
  readonly name: string;
  /** Channel type */
  readonly type: ChannelType;

  /** Initialize the adapter */
  initialize(): Promise<void>;
  /** Close the adapter */
  close(): Promise<void>;
  /** Register message handler */
  onMessage(handler: (msg: IncomingMessage) => Promise<void>): void;
  /** Send a message */
  send(peerId: string, content: MessageContent): Promise<void>;
  /** Check if connected */
  isConnected(): boolean;
}
