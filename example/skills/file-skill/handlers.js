/**
 * File Skill Handlers
 *
 * Provides file operations: read, write, list directory
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Read file contents
 */
async function readFile(args) {
  const filePath = args.path;
  const encoding = args.encoding || 'utf-8';

  if (!filePath) {
    return 'Error: path is required';
  }

  try {
    const resolvedPath = path.resolve(filePath);
    const stat = await fs.stat(resolvedPath);

    if (stat.isDirectory()) {
      return `Error: "${filePath}" is a directory. Use list_directory to view directory contents.`;
    }

    const content = await fs.readFile(resolvedPath, { encoding });
    return content;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return `Error: File not found: ${filePath}`;
    }
    if (error.code === 'EACCES') {
      return `Error: Permission denied: ${filePath}`;
    }
    return `Error reading file: ${error.message}`;
  }
}

/**
 * Write content to file
 */
async function writeFile(args) {
  const filePath = args.path;
  const content = args.content;
  const append = args.append || false;

  if (!filePath) {
    return 'Error: path is required';
  }
  if (content === undefined) {
    return 'Error: content is required';
  }

  try {
    const resolvedPath = path.resolve(filePath);

    // Ensure parent directory exists
    const dir = path.dirname(resolvedPath);
    await fs.mkdir(dir, { recursive: true });

    if (append) {
      await fs.appendFile(resolvedPath, content, 'utf-8');
      return `Successfully appended to file: ${filePath}`;
    } else {
      await fs.writeFile(resolvedPath, content, 'utf-8');
      return `Successfully wrote to file: ${filePath}`;
    }
  } catch (error) {
    if (error.code === 'EACCES') {
      return `Error: Permission denied: ${filePath}`;
    }
    return `Error writing file: ${error.message}`;
  }
}

/**
 * List directory contents
 */
async function listDirectory(args) {
  const dirPath = args.path || '.';
  const showHidden = args.showHidden || false;

  try {
    const resolvedPath = path.resolve(dirPath);
    const stat = await fs.stat(resolvedPath);

    if (!stat.isDirectory()) {
      return `Error: "${dirPath}" is not a directory`;
    }

    const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
    const items = [];

    for (const entry of entries) {
      // Skip hidden files unless requested
      if (!showHidden && entry.name.startsWith('.')) {
        continue;
      }

      const type = entry.isDirectory() ? 'dir' : 'file';
      const fullPath = path.join(resolvedPath, entry.name);

      try {
        const entryStat = await fs.stat(fullPath);
        items.push({
          name: entry.name,
          type,
          size: type === 'file' ? entryStat.size : null,
          modified: entryStat.mtime.toISOString(),
        });
      } catch {
        // If we can't stat, still include basic info
        items.push({
          name: entry.name,
          type,
        });
      }
    }

    // Sort: directories first, then files, alphabetically
    items.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'dir' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    // Format output
    const lines = items.map((item) => {
      const prefix = item.type === 'dir' ? '📁' : '📄';
      const sizeStr = item.size ? ` (${formatSize(item.size)})` : '';
      return `${prefix} ${item.name}${sizeStr}`;
    });

    return `Directory: ${resolvedPath}\n\n${lines.join('\n')}`;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return `Error: Directory not found: ${dirPath}`;
    }
    if (error.code === 'EACCES') {
      return `Error: Permission denied: ${dirPath}`;
    }
    return `Error listing directory: ${error.message}`;
  }
}

/**
 * Format file size in human-readable format
 */
function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

module.exports = {
  readFile,
  writeFile,
  listDirectory,
};
