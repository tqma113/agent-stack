/**
 * @ai-stack/skill - Helper Functions
 */

/**
 * Sanitize tool name for use as identifier
 * Replaces invalid characters with underscores
 */
export function sanitizeToolName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Generate a unique tool name with skill prefix
 */
export function generateToolName(
  skillName: string,
  toolName: string,
  options?: {
    prefix?: string;
    includeSkillName?: boolean;
    transformer?: (skill: string, tool: string) => string;
  }
): string {
  if (options?.transformer) {
    return options.transformer(skillName, toolName);
  }

  const prefix = options?.prefix ?? '';
  const sanitizedSkill = sanitizeToolName(skillName);
  const sanitizedTool = sanitizeToolName(toolName);

  if (options?.includeSkillName) {
    return `${prefix}${sanitizedSkill}__${sanitizedTool}`;
  }

  return `${prefix}${sanitizedTool}`;
}

/**
 * Parse handler path to extract file and function name
 * Supports formats:
 * - './handlers.js#myTool' -> { file: './handlers.js', exportName: 'myTool' }
 * - './handler.ts' -> { file: './handler.ts', exportName: 'default' }
 * - 'myTool' -> { file: undefined, exportName: 'myTool' }
 */
export function parseHandlerPath(handlerPath: string): {
  file: string | undefined;
  exportName: string;
} {
  // Check if it contains a file path (has a slash or starts with .)
  const hasFilePath = handlerPath.includes('/') || handlerPath.startsWith('.');

  if (!hasFilePath) {
    return { file: undefined, exportName: handlerPath };
  }

  // Check for # separator
  const hashIndex = handlerPath.lastIndexOf('#');

  if (hashIndex !== -1) {
    return {
      file: handlerPath.slice(0, hashIndex),
      exportName: handlerPath.slice(hashIndex + 1),
    };
  }

  // No # separator, use default export
  return {
    file: handlerPath,
    exportName: 'default',
  };
}

/**
 * Format error for tool result
 */
export function formatErrorResult(error: unknown): string {
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }
  return `Error: ${String(error)}`;
}

/**
 * Check if a value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as object,
        sourceValue as object
      ) as T[keyof T];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safe JSON stringify with circular reference handling
 */
export function safeStringify(value: unknown, indent?: number): string {
  const seen = new WeakSet();

  return JSON.stringify(
    value,
    (_, val) => {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) {
          return '[Circular]';
        }
        seen.add(val);
      }
      return val;
    },
    indent
  );
}

/**
 * Normalize file extension for import
 * Converts .ts to .js for runtime imports
 */
export function normalizeExtension(filePath: string): string {
  // At runtime, .ts files are typically compiled to .js
  // But we also want to support direct .ts imports in some environments
  return filePath.replace(/\.ts$/, '.js');
}

/**
 * Check if path is absolute
 */
export function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:/.test(path);
}
