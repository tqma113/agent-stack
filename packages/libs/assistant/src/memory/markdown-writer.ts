/**
 * @ai-stack/assistant - Markdown Writer
 *
 * Writes structured data back to Markdown files.
 */

import { writeFileSync, existsSync, mkdirSync, readFileSync, appendFileSync } from 'fs';
import { dirname, join } from 'path';
import matter from 'gray-matter';
import type {
  MemoryDocument,
  FactItem,
  TodoItem,
  DailyLogEntry,
} from './types.js';
import { getTodayDateString, getTodayLogPath } from './markdown-parser.js';

/**
 * Write a complete MEMORY.md file
 */
export function writeMemoryFile(filePath: string, doc: MemoryDocument): void {
  const content = serializeMemoryDocument(doc);
  ensureDirectory(dirname(filePath));
  writeFileSync(filePath, content, 'utf-8');
}

/**
 * Serialize a MemoryDocument to Markdown
 */
export function serializeMemoryDocument(doc: MemoryDocument): string {
  const sections: string[] = [];

  // Add frontmatter if there's metadata
  let frontmatter = '';
  if (Object.keys(doc.metadata).length > 0) {
    frontmatter = matter.stringify('', doc.metadata).trim() + '\n\n';
  }

  // Title
  sections.push('# Assistant Memory\n');

  // Profile section
  sections.push('## Profile\n');
  if (Object.keys(doc.profile).length > 0) {
    for (const [key, value] of Object.entries(doc.profile)) {
      const displayKey = key.charAt(0).toUpperCase() + key.slice(1);
      sections.push(`- **${displayKey}**: ${value}`);
    }
  }
  sections.push('');

  // Facts section
  sections.push('## Facts\n');
  if (doc.facts.length > 0) {
    for (const fact of doc.facts) {
      sections.push(`- ${fact.content}`);
    }
  }
  sections.push('');

  // Todos section
  sections.push('## Todos\n');
  if (doc.todos.length > 0) {
    for (const todo of doc.todos) {
      const checkbox = todo.completed ? '[x]' : '[ ]';
      sections.push(`- ${checkbox} ${todo.content}`);
    }
  }
  sections.push('');

  // Notes section
  sections.push('## Notes\n');
  if (doc.notes) {
    sections.push(doc.notes);
  }

  return frontmatter + sections.join('\n');
}

/**
 * Add a fact to MEMORY.md
 */
export function addFact(filePath: string, fact: string): FactItem {
  const doc = readMemoryDocument(filePath);

  const newFact: FactItem = {
    id: generateId(),
    content: fact,
    createdAt: new Date(),
  };

  doc.facts.push(newFact);
  writeMemoryFile(filePath, doc);

  return newFact;
}

/**
 * Remove a fact from MEMORY.md
 */
export function removeFact(filePath: string, factId: string): boolean {
  const doc = readMemoryDocument(filePath);
  const index = doc.facts.findIndex((f) => f.id === factId);

  if (index === -1) return false;

  doc.facts.splice(index, 1);
  writeMemoryFile(filePath, doc);

  return true;
}

/**
 * Add a todo to MEMORY.md
 */
export function addTodo(filePath: string, content: string, priority?: 'high' | 'medium' | 'low'): TodoItem {
  const doc = readMemoryDocument(filePath);

  const newTodo: TodoItem = {
    id: generateId(),
    content,
    completed: false,
    priority,
    createdAt: new Date(),
  };

  doc.todos.push(newTodo);
  writeMemoryFile(filePath, doc);

  return newTodo;
}

/**
 * Update a todo in MEMORY.md
 */
export function updateTodo(filePath: string, todoId: string, update: Partial<TodoItem>): boolean {
  const doc = readMemoryDocument(filePath);
  const index = doc.todos.findIndex((t) => t.id === todoId);

  if (index === -1) return false;

  doc.todos[index] = { ...doc.todos[index], ...update };
  writeMemoryFile(filePath, doc);

  return true;
}

/**
 * Remove a todo from MEMORY.md
 */
export function removeTodo(filePath: string, todoId: string): boolean {
  const doc = readMemoryDocument(filePath);
  const index = doc.todos.findIndex((t) => t.id === todoId);

  if (index === -1) return false;

  doc.todos.splice(index, 1);
  writeMemoryFile(filePath, doc);

  return true;
}

/**
 * Update profile in MEMORY.md
 */
export function updateProfile(filePath: string, key: string, value: unknown): void {
  const doc = readMemoryDocument(filePath);
  doc.profile[key] = value;
  writeMemoryFile(filePath, doc);
}

/**
 * Append notes to MEMORY.md
 */
export function appendNotes(filePath: string, notes: string): void {
  const doc = readMemoryDocument(filePath);
  doc.notes = doc.notes ? `${doc.notes}\n\n${notes}` : notes;
  writeMemoryFile(filePath, doc);
}

/**
 * Write a daily log entry
 */
export function writeDailyLogEntry(logsDir: string, entry: DailyLogEntry): void {
  ensureDirectory(logsDir);
  const logPath = getTodayLogPath(logsDir);

  // Check if file exists and has content
  const fileExists = existsSync(logPath);
  const hasContent = fileExists && readFileSync(logPath, 'utf-8').trim().length > 0;

  // Format entry
  const time = formatTime(entry.timestamp);
  const typeLabel = entry.type.charAt(0).toUpperCase() + entry.type.slice(1);
  const header = `### ${time} - ${typeLabel}\n\n`;
  const content = entry.content + '\n\n';

  if (!fileExists) {
    // Create new file with header
    const dateHeader = `# Daily Log - ${getTodayDateString()}\n\n`;
    writeFileSync(logPath, dateHeader + header + content, 'utf-8');
  } else if (!hasContent) {
    const dateHeader = `# Daily Log - ${getTodayDateString()}\n\n`;
    writeFileSync(logPath, dateHeader + header + content, 'utf-8');
  } else {
    // Append to existing file
    appendFileSync(logPath, header + content);
  }
}

/**
 * Format a Date to HH:MM string
 */
function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Read and parse MEMORY.md, returning empty doc if not exists
 */
function readMemoryDocument(filePath: string): MemoryDocument {
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

  // Parse sections (simplified version)
  const sections = parseSections(body);

  return {
    profile: parseProfile(sections['Profile'] || ''),
    facts: parseFacts(sections['Facts'] || ''),
    todos: parseTodos(sections['Todos'] || ''),
    notes: sections['Notes'] || '',
    metadata,
  };
}

/**
 * Parse sections by H2 headers
 */
function parseSections(content: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = content.split('\n');

  let currentSection = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^## (.+)$/);
    if (headerMatch) {
      if (currentSection) {
        sections[currentSection] = currentContent.join('\n').trim();
      }
      currentSection = headerMatch[1].trim();
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  if (currentSection) {
    sections[currentSection] = currentContent.join('\n').trim();
  }

  return sections;
}

/**
 * Parse profile section
 */
function parseProfile(content: string): Record<string, unknown> {
  const profile: Record<string, unknown> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const match = line.match(/^-\s*\*\*(.+?)\*\*:\s*(.+)$/);
    if (match) {
      const key = match[1].trim().toLowerCase();
      profile[key] = match[2].trim();
    }
  }

  return profile;
}

/**
 * Parse facts section
 */
function parseFacts(content: string): FactItem[] {
  const facts: FactItem[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const match = line.match(/^-\s+(.+)$/);
    if (match && match[1].trim()) {
      facts.push({
        id: generateId(),
        content: match[1].trim(),
        createdAt: new Date(),
      });
    }
  }

  return facts;
}

/**
 * Parse todos section
 */
function parseTodos(content: string): TodoItem[] {
  const todos: TodoItem[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const match = line.match(/^-\s+\[([ xX])\]\s+(.+)$/);
    if (match && match[2].trim()) {
      todos.push({
        id: generateId(),
        content: match[2].trim(),
        completed: match[1].toLowerCase() === 'x',
        createdAt: new Date(),
      });
    }
  }

  return todos;
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Ensure directory exists
 */
function ensureDirectory(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
