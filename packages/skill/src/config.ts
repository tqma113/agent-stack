/**
 * @agent-stack/skill - Configuration Loading
 */

import { readFile, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import type { SkillConfig, SkillDefinition } from './types';
import { SkillConfigurationError } from './types';
import { isObject } from './helpers';

/**
 * Default configuration file names to search for
 */
export const CONFIG_FILE_NAMES = ['skills.json', '.skills.json'];

/**
 * Default skill directories to auto-discover
 */
export const SKILL_DIRECTORIES = ['skills/', '.skills/'];

/**
 * Skill definition file name
 */
export const SKILL_DEFINITION_FILE = 'skill.json';

/**
 * Load skill configuration from a file path
 */
export async function loadConfig(configPath: string): Promise<SkillConfig> {
  const absolutePath = resolve(configPath);

  if (!existsSync(absolutePath)) {
    throw new SkillConfigurationError(
      `Configuration file not found: ${absolutePath}`
    );
  }

  const content = await readFile(absolutePath, 'utf-8');
  return parseConfig(content);
}

/**
 * Load skill configuration from default locations
 * Searches current directory and parent directories
 */
export async function loadConfigFromDefaults(
  startDir?: string
): Promise<SkillConfig | null> {
  const configPath = findConfigFile(startDir);

  if (!configPath) {
    return null;
  }

  return loadConfig(configPath);
}

/**
 * Find configuration file in directory hierarchy
 */
export function findConfigFile(startDir?: string): string | null {
  let currentDir = startDir ?? process.cwd();
  const root = resolve('/');

  while (currentDir !== root) {
    for (const fileName of CONFIG_FILE_NAMES) {
      const configPath = resolve(currentDir, fileName);
      if (existsSync(configPath)) {
        return configPath;
      }
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return null;
}

/**
 * Parse and validate configuration
 */
export function parseConfig(content: string): SkillConfig {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new SkillConfigurationError(
      `Invalid JSON in configuration file: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!isObject(parsed)) {
    throw new SkillConfigurationError('Configuration must be an object');
  }

  // Handle both 'skills' property and direct skill entries
  let skills: Record<string, unknown>;
  let autoLoad: boolean | undefined;

  if ('skills' in parsed && isObject(parsed.skills)) {
    skills = parsed.skills;
    autoLoad = typeof parsed.autoLoad === 'boolean' ? parsed.autoLoad : undefined;
  } else {
    // Treat the whole object as skills entries
    skills = parsed;
  }

  // Validate each skill entry
  for (const [name, entry] of Object.entries(skills)) {
    validateSkillEntry(name, entry);
  }

  return {
    skills: skills as SkillConfig['skills'],
    autoLoad,
  };
}

/**
 * Validate a skill entry in configuration
 */
export function validateSkillEntry(name: string, entry: unknown): void {
  if (!isObject(entry)) {
    throw new SkillConfigurationError(
      `Skill "${name}" entry must be an object`
    );
  }

  // Must have either path or package
  if (!entry.path && !entry.package) {
    throw new SkillConfigurationError(
      `Skill "${name}" must have either "path" or "package" property`
    );
  }

  if (entry.path && typeof entry.path !== 'string') {
    throw new SkillConfigurationError(
      `Skill "${name}" path must be a string`
    );
  }

  if (entry.package && typeof entry.package !== 'string') {
    throw new SkillConfigurationError(
      `Skill "${name}" package must be a string`
    );
  }
}

/**
 * Load skill definition from a directory
 */
export async function loadSkillDefinition(
  skillDir: string
): Promise<SkillDefinition> {
  const definitionPath = join(skillDir, SKILL_DEFINITION_FILE);

  if (!existsSync(definitionPath)) {
    throw new SkillConfigurationError(
      `Skill definition not found: ${definitionPath}`
    );
  }

  const content = await readFile(definitionPath, 'utf-8');
  return parseSkillDefinition(content, skillDir);
}

/**
 * Parse and validate skill definition
 */
export function parseSkillDefinition(
  content: string,
  skillDir: string
): SkillDefinition {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new SkillConfigurationError(
      `Invalid JSON in skill.json at ${skillDir}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!isObject(parsed)) {
    throw new SkillConfigurationError(
      `skill.json must be an object at ${skillDir}`
    );
  }

  // Validate required fields
  if (!parsed.name || typeof parsed.name !== 'string') {
    throw new SkillConfigurationError(
      `skill.json must have a "name" string at ${skillDir}`
    );
  }

  // Validate tools if present
  if (parsed.tools !== undefined) {
    if (!Array.isArray(parsed.tools)) {
      throw new SkillConfigurationError(
        `skill.json "tools" must be an array at ${skillDir}`
      );
    }

    for (const [index, tool] of parsed.tools.entries()) {
      validateToolDefinition(tool, index, skillDir);
    }
  }

  return parsed as unknown as SkillDefinition;
}

/**
 * Validate tool definition
 */
function validateToolDefinition(
  tool: unknown,
  index: number,
  skillDir: string
): void {
  if (!isObject(tool)) {
    throw new SkillConfigurationError(
      `Tool at index ${index} must be an object at ${skillDir}`
    );
  }

  if (!tool.name || typeof tool.name !== 'string') {
    throw new SkillConfigurationError(
      `Tool at index ${index} must have a "name" string at ${skillDir}`
    );
  }

  if (!tool.description || typeof tool.description !== 'string') {
    throw new SkillConfigurationError(
      `Tool "${tool.name}" must have a "description" string at ${skillDir}`
    );
  }

  if (!tool.handler || typeof tool.handler !== 'string') {
    throw new SkillConfigurationError(
      `Tool "${tool.name}" must have a "handler" string at ${skillDir}`
    );
  }

  if (tool.parameters !== undefined && !isObject(tool.parameters)) {
    throw new SkillConfigurationError(
      `Tool "${tool.name}" parameters must be an object at ${skillDir}`
    );
  }
}

/**
 * Discover skills in a directory
 * Looks for subdirectories containing skill.json
 */
export async function discoverSkills(
  directory: string
): Promise<Array<{ name: string; path: string; definition: SkillDefinition }>> {
  const absoluteDir = resolve(directory);

  if (!existsSync(absoluteDir)) {
    return [];
  }

  const entries = await readdir(absoluteDir, { withFileTypes: true });
  const discovered: Array<{
    name: string;
    path: string;
    definition: SkillDefinition;
  }> = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const skillDir = join(absoluteDir, entry.name);
    const definitionPath = join(skillDir, SKILL_DEFINITION_FILE);

    if (existsSync(definitionPath)) {
      try {
        const definition = await loadSkillDefinition(skillDir);
        discovered.push({
          name: definition.name,
          path: skillDir,
          definition,
        });
      } catch (error) {
        // Log but continue discovering other skills
        console.warn(
          `Failed to load skill from ${skillDir}:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  return discovered;
}

/**
 * Auto-discover skills from default directories
 */
export async function discoverSkillsFromDefaults(
  startDir?: string
): Promise<Array<{ name: string; path: string; definition: SkillDefinition }>> {
  const baseDir = startDir ?? process.cwd();
  const allDiscovered: Array<{
    name: string;
    path: string;
    definition: SkillDefinition;
  }> = [];

  for (const dir of SKILL_DIRECTORIES) {
    const fullPath = join(baseDir, dir);
    const discovered = await discoverSkills(fullPath);
    allDiscovered.push(...discovered);
  }

  return allDiscovered;
}
