/**
 * @ai-stack/agent - Configuration Schema
 *
 * Zod schemas for validating agent configuration files.
 */

import { z } from 'zod';

// =============================================================================
// Memory Configuration Schema
// =============================================================================

export const TokenBudgetSchema = z.object({
  profile: z.number().int().positive().optional(),
  taskState: z.number().int().positive().optional(),
  recentEvents: z.number().int().positive().optional(),
  semanticChunks: z.number().int().positive().optional(),
  summary: z.number().int().positive().optional(),
  total: z.number().int().positive().optional(),
}).strict();

export const WritePolicyConfigSchema = z.object({
  autoSummarize: z.boolean().optional(),
  summarizeEveryNEvents: z.number().int().positive().optional(),
  conflictStrategy: z.enum(['latest', 'confidence', 'explicit', 'manual']).optional(),
}).strict();

export const RetrievalConfigSchema = z.object({
  maxRecentEvents: z.number().int().nonnegative().optional(),
  maxSemanticChunks: z.number().int().nonnegative().optional(),
  enableSemanticSearch: z.boolean().optional(),
}).strict();

export const MemoryConfigSectionSchema = z.object({
  enabled: z.boolean().optional(),
  dbPath: z.string().optional(),
  autoInitialize: z.boolean().optional(),
  autoInject: z.boolean().optional(),
  tokenBudget: TokenBudgetSchema.optional(),
  writePolicy: WritePolicyConfigSchema.optional(),
  retrieval: RetrievalConfigSchema.optional(),
  debug: z.boolean().optional(),
}).strict();

// =============================================================================
// Skill Configuration Schema
// =============================================================================

export const SkillEntrySchema = z.object({
  path: z.string().optional(),
  package: z.string().optional(),
  enabled: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
}).strict();

export const SkillConfigSectionSchema = z.object({
  directories: z.array(z.string()).optional(),
  skills: z.record(SkillEntrySchema).optional(),
  autoLoad: z.boolean().optional(),
}).strict();

// =============================================================================
// MCP Configuration Schema
// =============================================================================

export const MCPConfigSectionSchema = z.object({
  configPath: z.string().optional(),
  autoConnect: z.boolean().optional(),
}).strict();

// =============================================================================
// Knowledge Configuration Schema
// =============================================================================

export const CodeConfigSchema = z.object({
  enabled: z.boolean().optional(),
  rootDir: z.string().optional(),
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  maxFileSize: z.number().int().positive().optional(),
  chunkTokens: z.number().int().positive().optional(),
  overlapTokens: z.number().int().nonnegative().optional(),
  watch: z.boolean().optional(),
  watchDebounceMs: z.number().int().positive().optional(),
  concurrency: z.number().int().positive().optional(),
}).strict();

export const DocSourceSchema = z.object({
  name: z.string(),
  type: z.enum(['url', 'sitemap', 'file', 'directory']),
  url: z.string().url().optional(),
  path: z.string().optional(),
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
}).strict();

export const DocConfigSchema = z.object({
  enabled: z.boolean().optional(),
  userAgent: z.string().optional(),
  chunkTokens: z.number().int().positive().optional(),
  overlapTokens: z.number().int().nonnegative().optional(),
  concurrency: z.number().int().positive().optional(),
  cacheDir: z.string().optional(),
  cacheTtl: z.number().int().positive().optional(),
  sources: z.array(DocSourceSchema).optional(),
}).strict();

export const SearchConfigSchema = z.object({
  autoSearch: z.boolean().optional(),
  autoInject: z.boolean().optional(),
  minScore: z.number().min(0).max(1).optional(),
  maxResults: z.number().int().positive().optional(),
  weights: z.object({
    fts: z.number().min(0).max(1),
    vector: z.number().min(0).max(1),
  }).optional(),
}).strict();

export const KnowledgeConfigSectionSchema = z.object({
  enabled: z.boolean().optional(),
  dbPath: z.string().optional(),
  code: CodeConfigSchema.optional(),
  doc: DocConfigSchema.optional(),
  search: SearchConfigSchema.optional(),
  autoInitialize: z.boolean().optional(),
  debug: z.boolean().optional(),
}).strict();

// =============================================================================
// Permission Configuration Schema
// =============================================================================

export const PermissionLevelSchema = z.enum(['allow', 'confirm', 'deny']);

export const PermissionRuleSchema = z.object({
  toolPattern: z.string(),
  level: PermissionLevelSchema,
  description: z.string().optional(),
}).strict();

export const PermissionConfigSectionSchema = z.object({
  enabled: z.boolean().optional(),
  defaultLevel: PermissionLevelSchema.optional(),
  rules: z.array(PermissionRuleSchema).optional(),
  sessionMemory: z.boolean().optional(),
}).strict();

// =============================================================================
// Security Configuration Schema
// =============================================================================

export const SecurityConfigSectionSchema = z.object({
  confirmDangerousCommands: z.boolean().optional(),
}).strict();

// =============================================================================
// Provider Configuration Schema
// =============================================================================

export const ProviderConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google', 'openai-compatible']),
  apiKey: z.string().optional(),
  baseURL: z.string().url().optional(),
  timeout: z.number().int().positive().optional(),
  maxRetries: z.number().int().nonnegative().optional(),
}).strict();

// =============================================================================
// Main Configuration Schema
// =============================================================================

/**
 * Schema for agent.json configuration file
 */
export const AgentStackConfigSchema = z.object({
  /** LLM model to use (e.g., 'gpt-4o', 'claude-3-5-sonnet-20241022') */
  model: z.string().optional(),

  /** Temperature for response generation (0-2) */
  temperature: z.number().min(0).max(2).optional(),

  /** Maximum tokens in response */
  maxTokens: z.number().int().positive().optional(),

  /** Maximum tool call iterations per conversation turn */
  maxIterations: z.number().int().positive().optional(),

  /** System prompt for the agent */
  systemPrompt: z.string().optional(),

  /** OpenAI API key (prefer env var OPENAI_API_KEY) */
  apiKey: z.string().optional(),

  /** Custom API base URL */
  baseURL: z.string().url().optional(),

  /** Multi-model provider configuration */
  provider: ProviderConfigSchema.optional(),

  /** Skill configuration */
  skill: SkillConfigSectionSchema.optional(),

  /** MCP configuration */
  mcp: MCPConfigSectionSchema.optional(),

  /** Memory configuration */
  memory: MemoryConfigSectionSchema.optional(),

  /** Knowledge configuration */
  knowledge: KnowledgeConfigSectionSchema.optional(),

  /** Permission configuration */
  permission: PermissionConfigSectionSchema.optional(),

  /** Security settings */
  security: SecurityConfigSectionSchema.optional(),
}).strict();

/**
 * Type derived from the schema
 */
export type AgentStackConfigSchemaType = z.infer<typeof AgentStackConfigSchema>;

// =============================================================================
// Validation Utilities
// =============================================================================

/**
 * Validation error with path information
 */
export interface ValidationError {
  path: string;
  message: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  success: boolean;
  data?: AgentStackConfigSchemaType;
  errors?: ValidationError[];
}

/**
 * Validate configuration against the schema
 *
 * @param config - Configuration object to validate
 * @returns Validation result with errors if invalid
 */
export function validateConfig(config: unknown): ValidationResult {
  const result = AgentStackConfigSchema.safeParse(config);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  // Transform Zod errors into our format
  const errors: ValidationError[] = result.error.errors.map((error) => ({
    path: error.path.join('.') || 'root',
    message: error.message,
  }));

  return {
    success: false,
    errors,
  };
}

/**
 * Format validation errors for display
 *
 * @param errors - Array of validation errors
 * @returns Formatted error string
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) {
    return 'No errors';
  }

  const lines = errors.map((error) => {
    const path = error.path === 'root' ? 'Configuration' : `"${error.path}"`;
    return `  - ${path}: ${error.message}`;
  });

  return `Configuration validation failed:\n${lines.join('\n')}`;
}
