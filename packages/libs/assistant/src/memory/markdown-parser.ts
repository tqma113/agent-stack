/**
 * @ai-stack/assistant - Markdown Parser
 *
 * Parses MEMORY.md and daily log files into structured data.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import matter from 'gray-matter';
import type {
  MemoryDocument,
  ProfileSection,
  FactItem,
  TodoItem,
  DailyLog,
  DailyLogEntry,
} from './types.js';

/**
 * Generate a unique ID for items
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Parse a MEMORY.md file
 */
export function parseMemoryFile(filePath: string): MemoryDocument {
  if (!existsSync(filePath)) {
    return {
      profile: {},
      facts: [],
      todos: [],
      notes: '',
      metadata: {},
    };
  }

  const content = readFileSync(filePath, 'utf-8');
  const { data: metadata, content: body } = matter(content);

  // Parse sections
  const sections = parseSections(body);

  return {
    profile: parseProfileSection(sections['Profile'] || ''),
    facts: parseFactsSection(sections['Facts'] || ''),
    todos: parseTodosSection(sections['Todos'] || ''),
    notes: sections['Notes'] || '',
    metadata,
  };
}

/**
 * Parse markdown content into sections by H2 headers
 */
function parseSections(content: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = content.split('\n');

  let currentSection = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^## (.+)$/);
    if (headerMatch) {
      // Save previous section
      if (currentSection) {
        sections[currentSection] = currentContent.join('\n').trim();
      }
      currentSection = headerMatch[1].trim();
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    sections[currentSection] = currentContent.join('\n').trim();
  }

  return sections;
}

/**
 * Parse Profile section
 */
function parseProfileSection(content: string): ProfileSection {
  const profile: ProfileSection = {};

  // Parse key-value pairs like "- **Key**: Value"
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/^-\s*\*\*(.+?)\*\*:\s*(.+)$/);
    if (match) {
      const key = match[1].trim().toLowerCase();
      const value = match[2].trim();
      profile[key] = value;
    }
  }

  return profile;
}

/**
 * Parse Facts section
 */
function parseFactsSection(content: string): FactItem[] {
  const facts: FactItem[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // Parse "- Fact content"
    const match = line.match(/^-\s+(.+)$/);
    if (match) {
      const factContent = match[1].trim();
      // Skip empty or placeholder items
      if (factContent && !factContent.startsWith('(')) {
        facts.push({
          id: generateId(),
          content: factContent,
          createdAt: new Date(),
        });
      }
    }
  }

  return facts;
}

/**
 * Parse Todos section
 */
function parseTodosSection(content: string): TodoItem[] {
  const todos: TodoItem[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // Parse "- [ ] Task" or "- [x] Task"
    const match = line.match(/^-\s+\[([ xX])\]\s+(.+)$/);
    if (match) {
      const completed = match[1].toLowerCase() === 'x';
      const todoContent = match[2].trim();
      // Skip placeholder items
      if (todoContent && !todoContent.startsWith('(')) {
        todos.push({
          id: generateId(),
          content: todoContent,
          completed,
          createdAt: new Date(),
        });
      }
    }
  }

  return todos;
}

/**
 * Parse a daily log file (YYYY-MM-DD.md)
 */
export function parseDailyLogFile(filePath: string): DailyLog | null {
  if (!existsSync(filePath)) {
    return null;
  }

  const dateMatch = basename(filePath).match(/^(\d{4}-\d{2}-\d{2})\.md$/);
  if (!dateMatch) {
    return null;
  }

  const date = dateMatch[1];
  const content = readFileSync(filePath, 'utf-8');
  const entries = parseDailyLogContent(content);

  return { date, entries };
}

/**
 * Parse daily log content into entries
 */
function parseDailyLogContent(content: string): DailyLogEntry[] {
  const entries: DailyLogEntry[] = [];
  const lines = content.split('\n');

  let currentEntry: Partial<DailyLogEntry> | null = null;
  let contentLines: string[] = [];

  for (const line of lines) {
    // Parse entry header: ### HH:MM - type
    const headerMatch = line.match(/^###\s+(\d{2}:\d{2})\s*-?\s*(\w+)?$/);
    if (headerMatch) {
      // Save previous entry
      if (currentEntry) {
        entries.push({
          ...currentEntry,
          content: contentLines.join('\n').trim(),
        } as DailyLogEntry);
      }

      const time = headerMatch[1];
      const type = (headerMatch[2]?.toLowerCase() || 'user') as DailyLogEntry['type'];

      currentEntry = {
        timestamp: parseTimeToDate(time),
        type,
      };
      contentLines = [];
    } else if (currentEntry) {
      contentLines.push(line);
    }
  }

  // Save last entry
  if (currentEntry) {
    entries.push({
      ...currentEntry,
      content: contentLines.join('\n').trim(),
    } as DailyLogEntry);
  }

  return entries;
}

/**
 * Parse time string to Date (using today's date)
 */
function parseTimeToDate(time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/**
 * Load all daily logs from a directory
 */
export function loadDailyLogs(logsDir: string, options?: {
  limit?: number;
  from?: Date;
  to?: Date;
}): DailyLog[] {
  if (!existsSync(logsDir)) {
    return [];
  }

  const files = readdirSync(logsDir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()
    .reverse(); // Most recent first

  let logs: DailyLog[] = [];

  for (const file of files) {
    const date = file.replace('.md', '');
    const fileDate = new Date(date);

    // Apply date filters
    if (options?.from && fileDate < options.from) continue;
    if (options?.to && fileDate > options.to) continue;

    const log = parseDailyLogFile(join(logsDir, file));
    if (log) {
      logs.push(log);
    }

    // Apply limit
    if (options?.limit && logs.length >= options.limit) break;
  }

  return logs;
}

/**
 * Get today's date string in YYYY-MM-DD format
 */
export function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Get the file path for today's log
 */
export function getTodayLogPath(logsDir: string): string {
  return join(logsDir, `${getTodayDateString()}.md`);
}
