/**
 * @ai-stack/code - Configuration Schema (Zod Validation)
 */

import { z } from 'zod';

/**
 * Safety configuration schema
 */
export const SafetyConfigSchema = z.object({
  workingDir: z.string().optional(),
  allowedPaths: z.array(z.string()).optional(),
  blockedPaths: z.array(z.string()).optional(),
  maxFileSize: z.number().positive().optional(),
  blockSecrets: z.boolean().optional(),
  confirmDestructive: z.boolean().optional(),
});

/**
 * History configuration schema
 */
export const HistoryConfigSchema = z.object({
  enabled: z.boolean().optional(),
  dbPath: z.string().optional(),
  maxChanges: z.number().positive().optional(),
});

/**
 * Task configuration schema
 */
export const TaskConfigSchema = z.object({
  enabled: z.boolean().optional(),
  dbPath: z.string().optional(),
});

/**
 * MCP configuration schema
 */
export const MCPConfigSchema = z.object({
  configPath: z.string().optional(),
  autoConnect: z.boolean().optional(),
});

/**
 * Code configuration schema
 */
export const CodeConfigSchema = z.object({
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  maxIterations: z.number().positive().optional(),
  apiKey: z.string().optional(),
  baseURL: z.string().url().optional(),

  safety: SafetyConfigSchema.optional(),
  history: HistoryConfigSchema.optional(),
  tasks: TaskConfigSchema.optional(),
  mcp: MCPConfigSchema.optional(),
});

/**
 * Validate configuration object
 */
export function validateConfig(config: unknown): z.infer<typeof CodeConfigSchema> {
  return CodeConfigSchema.parse(config);
}

/**
 * Safe validate configuration (returns error instead of throwing)
 */
export function safeValidateConfig(config: unknown): {
  success: true;
  data: z.infer<typeof CodeConfigSchema>;
} | {
  success: false;
  error: z.ZodError;
} {
  const result = CodeConfigSchema.safeParse(config);
  return result;
}
