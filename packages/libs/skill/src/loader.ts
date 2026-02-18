/**
 * @ai-stack/skill - Skill Loader
 *
 * Handles loading skills from directories and npm packages
 */

import { pathToFileURL } from 'url';
import { resolve, join } from 'path';
import { existsSync } from 'fs';
import type {
  SkillEntry,
  SkillDefinition,
  LoadedSkill,
  ResolvedTool,
  ToolHandler,
  HookHandler,
  SkillToolDefinition,
} from './types';
import { SkillLoadError, SkillHandlerError } from './types';
import { loadSkillDefinition } from './config';
import { parseHandlerPath, normalizeExtension } from './helpers';

/**
 * Load a skill from a SkillEntry
 */
export async function loadSkill(
  name: string,
  entry: SkillEntry
): Promise<LoadedSkill> {
  if (entry.path) {
    return loadSkillFromDirectory(name, entry.path, entry.config);
  }

  if (entry.package) {
    return loadSkillFromPackage(name, entry.package, entry.config);
  }

  throw new SkillLoadError(name, new Error('No path or package specified'));
}

/**
 * Load a skill from a local directory
 */
export async function loadSkillFromDirectory(
  name: string,
  skillPath: string,
  config?: Record<string, unknown>
): Promise<LoadedSkill> {
  const absolutePath = resolve(skillPath);

  if (!existsSync(absolutePath)) {
    throw new SkillLoadError(
      name,
      new Error(`Skill directory not found: ${absolutePath}`)
    );
  }

  try {
    // Load skill definition
    const definition = await loadSkillDefinition(absolutePath);

    // Create loaded skill with initial state
    const loadedSkill: LoadedSkill = {
      name: definition.name,
      definition,
      state: 'loading',
      path: absolutePath,
      tools: [],
      config,
    };

    // Resolve tool handlers
    if (definition.tools && definition.tools.length > 0) {
      loadedSkill.tools = await resolveToolHandlers(
        absolutePath,
        definition.tools,
        definition.name
      );
    }

    // Resolve lifecycle hooks
    if (definition.hooks) {
      loadedSkill.hooks = await resolveHooks(
        absolutePath,
        definition.hooks,
        definition.name
      );
    }

    loadedSkill.state = 'loaded';
    return loadedSkill;
  } catch (error) {
    if (error instanceof SkillLoadError || error instanceof SkillHandlerError) {
      throw error;
    }
    throw new SkillLoadError(
      name,
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Load a skill from an npm package
 */
export async function loadSkillFromPackage(
  name: string,
  packageName: string,
  config?: Record<string, unknown>
): Promise<LoadedSkill> {
  try {
    // Try to resolve the package
    const packagePath = await resolvePackagePath(packageName);

    // Load as directory
    return loadSkillFromDirectory(name, packagePath, config);
  } catch (error) {
    throw new SkillLoadError(
      name,
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Resolve npm package path
 */
async function resolvePackagePath(packageName: string): Promise<string> {
  try {
    // Try to resolve the package's main entry point
    const resolved = await import.meta.resolve?.(packageName);
    if (resolved) {
      // Convert file URL to path and get directory
      const filePath = new URL(resolved).pathname;
      // Return the package directory (parent of main file)
      return resolve(filePath, '..');
    }
  } catch {
    // Fall through to require.resolve
  }

  // Fallback: try require.resolve (available in Node.js)
  try {
    const resolved = require.resolve(packageName);
    return resolve(resolved, '..');
  } catch {
    throw new Error(`Cannot resolve package: ${packageName}`);
  }
}

/**
 * Resolve tool handlers from definitions
 */
async function resolveToolHandlers(
  skillPath: string,
  tools: SkillToolDefinition[],
  skillName: string
): Promise<ResolvedTool[]> {
  const resolved: ResolvedTool[] = [];

  for (const tool of tools) {
    const handler = await resolveToolHandler(
      skillPath,
      tool.handler,
      skillName,
      tool.name
    );

    resolved.push({
      definition: tool,
      handler,
    });
  }

  return resolved;
}

/**
 * Resolve a single tool handler
 *
 * Supports formats:
 * - './handlers.js#myTool' - Import named export 'myTool' from handlers.js
 * - './handler.ts' - Import default export from handler.ts
 * - './handlers#myTool' - Try multiple extensions
 */
export async function resolveToolHandler(
  skillPath: string,
  handlerPath: string,
  skillName: string,
  toolName: string
): Promise<ToolHandler> {
  const { file, exportName } = parseHandlerPath(handlerPath);

  if (!file) {
    throw new SkillHandlerError(
      skillName,
      handlerPath,
      new Error('Handler path must include a file path')
    );
  }

  try {
    // Resolve the file path
    const resolvedFile = resolveHandlerFile(skillPath, file);
    const fileUrl = pathToFileURL(resolvedFile).href;

    // Dynamic import
    const module = await import(fileUrl);

    // Get the handler function
    const handler =
      exportName === 'default' ? module.default : module[exportName];

    if (typeof handler !== 'function') {
      throw new Error(
        `Export "${exportName}" is not a function (got ${typeof handler})`
      );
    }

    return handler as ToolHandler;
  } catch (error) {
    throw new SkillHandlerError(
      skillName,
      handlerPath,
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Resolve handler file path with extension fallback
 */
function resolveHandlerFile(skillPath: string, file: string): string {
  const basePath = join(skillPath, file);

  // If file has extension, normalize it and return
  if (/\.[a-z]+$/i.test(file)) {
    const normalized = normalizeExtension(basePath);
    if (existsSync(normalized)) {
      return normalized;
    }
    // Also try the original path (for .ts files in dev mode)
    if (existsSync(basePath)) {
      return basePath;
    }
    throw new Error(`Handler file not found: ${file}`);
  }

  // Try common extensions
  const extensions = ['.js', '.mjs', '.cjs', '.ts'];
  for (const ext of extensions) {
    const fullPath = basePath + ext;
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }

  // Try index files
  for (const ext of extensions) {
    const indexPath = join(basePath, `index${ext}`);
    if (existsSync(indexPath)) {
      return indexPath;
    }
  }

  throw new Error(`Handler file not found: ${file}`);
}

/**
 * Resolve lifecycle hooks
 */
async function resolveHooks(
  skillPath: string,
  hooks: NonNullable<SkillDefinition['hooks']>,
  skillName: string
): Promise<LoadedSkill['hooks']> {
  const resolved: LoadedSkill['hooks'] = {};

  if (hooks.onLoad) {
    resolved.onLoad = await resolveHookHandler(
      skillPath,
      hooks.onLoad,
      skillName,
      'onLoad'
    );
  }

  if (hooks.onActivate) {
    resolved.onActivate = await resolveHookHandler(
      skillPath,
      hooks.onActivate,
      skillName,
      'onActivate'
    );
  }

  if (hooks.onDeactivate) {
    resolved.onDeactivate = await resolveHookHandler(
      skillPath,
      hooks.onDeactivate,
      skillName,
      'onDeactivate'
    );
  }

  if (hooks.onUnload) {
    resolved.onUnload = await resolveHookHandler(
      skillPath,
      hooks.onUnload,
      skillName,
      'onUnload'
    );
  }

  return resolved;
}

/**
 * Resolve a lifecycle hook handler
 */
async function resolveHookHandler(
  skillPath: string,
  handlerPath: string,
  skillName: string,
  hookName: string
): Promise<HookHandler> {
  const { file, exportName } = parseHandlerPath(handlerPath);

  if (!file) {
    throw new SkillHandlerError(
      skillName,
      handlerPath,
      new Error(`Hook "${hookName}" path must include a file path`)
    );
  }

  try {
    const resolvedFile = resolveHandlerFile(skillPath, file);
    const fileUrl = pathToFileURL(resolvedFile).href;

    const module = await import(fileUrl);

    const handler =
      exportName === 'default' ? module.default : module[exportName];

    if (typeof handler !== 'function') {
      throw new Error(
        `Hook "${hookName}" export "${exportName}" is not a function`
      );
    }

    return handler as HookHandler;
  } catch (error) {
    throw new SkillHandlerError(
      skillName,
      handlerPath,
      error instanceof Error ? error : new Error(String(error))
    );
  }
}
