/**
 * @ai-stack/assistant
 *
 * Personal AI assistant with Markdown memory, multi-channel gateway, and scheduled tasks.
 *
 * Features:
 * - Markdown Memory: MEMORY.md as source of truth with SQLite derived index
 * - Multi-channel Gateway: CLI, Telegram, Discord, WhatsApp support
 * - Scheduler: Cron jobs, reminders, file watchers
 * - Daemon: Background process management
 */

// Main Assistant
export { createAssistant, type AssistantInstance, type InitializeOptions } from './assistant/index.js';

// Memory System
export {
  createMarkdownMemory,
  type MarkdownMemoryInstance,
  createSqliteIndex,
  type SqliteIndexInstance,
  createSyncEngine,
  type SyncEngineInstance,
  parseMemoryFile,
  parseDailyLogFile,
  loadDailyLogs,
  writeMemoryFile,
  serializeMemoryDocument,
  addFact,
  removeFact,
  addTodo,
  updateTodo,
  removeTodo,
  updateProfile,
  appendNotes,
  writeDailyLogEntry,
  type MemoryDocument,
  type ProfileSection,
  type FactItem,
  type TodoItem,
  type DailyLogEntry,
  type DailyLog,
  type MarkdownMemoryConfig,
  type SyncStatus,
  type MemorySearchResult,
  type MemoryQueryOptions,
} from './memory/index.js';

// Gateway System
export {
  createGateway,
  type GatewayInstance,
  createSessionManager,
  type SessionManagerInstance,
  createRouter,
  type RouterInstance,
  type MessageHandler,
  BaseAdapter,
  CLIAdapter,
  createCLIAdapter,
  TelegramAdapter,
  createTelegramAdapter,
  DiscordAdapter,
  createDiscordAdapter,
  type GatewayConfig,
  type SessionStrategy,
  type ChannelConfigs,
  type IncomingMessage,
  type ChannelType,
  type MessageContent,
  type Session,
  type IChannelAdapter,
} from './gateway/index.js';

// Scheduler System
export {
  createScheduler,
  type SchedulerInstance,
  type JobExecutor,
  type AgentSchedulerTool,
  createTaskQueue,
  type TaskQueueInstance,
  getNextCronTime,
  isValidCronExpression,
  describeCronSchedule,
  createCronSchedule,
  parseNaturalTime,
  createReminderSchedule,
  formatReminder,
  createWatcher,
  createWatcherSchedule,
  type WatcherInstance,
  type SchedulerConfig,
  type JobType,
  type Job,
  type JobSchedule,
  type CronSchedule,
  type ReminderSchedule,
  type IntervalSchedule,
  type WatcherSchedule,
  type JobExecution,
  type JobDelivery,
  type JobRunResult,
  type CreateJobInput,
  type CreateReminderInput,
  type CreateCronJobInput,
} from './scheduler/index.js';

// Daemon System
export {
  createDaemon,
  updateDaemonMetrics,
  type DaemonInstance,
  type DaemonConfig,
  type DaemonStatus,
} from './daemon/index.js';

// Configuration
export {
  loadConfig,
  loadConfigFile,
  findConfigFile,
  resolveConfig,
  getDefaultConfig,
  initConfig,
  generateConfigTemplate,
  generateMemoryTemplate,
  serializeConfig,
  DEFAULT_BASE_DIR,
  type LoadConfigResult,
} from './config.js';

// Types
export type {
  AssistantConfig,
  AgentConfigSection,
} from './types.js';

// Re-export from @ai-stack/agent for convenience
export {
  createAgent,
  type AgentInstance,
  type AgentConfig,
  type Tool,
} from '@ai-stack/agent';
