/**
 * Search Skill Handlers
 *
 * Search files by pattern and content
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Simple glob pattern matching
 * Supports: *, **, ?
 */
function globToRegex(pattern) {
  let regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special chars
    .replace(/\*\*/g, '{{GLOBSTAR}}')      // Placeholder for **
    .replace(/\*/g, '[^/]*')               // * matches anything except /
    .replace(/\?/g, '[^/]')                // ? matches single char except /
    .replace(/{{GLOBSTAR}}/g, '.*');       // ** matches anything

  return new RegExp(`^${regex}$`);
}

/**
 * Recursively walk directory
 */
async function walkDir(dir, callback, basePath = dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      // Skip hidden and common ignore patterns
      if (entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue;
      }

      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(basePath, fullPath);

      if (entry.isDirectory()) {
        await walkDir(fullPath, callback, basePath);
      } else {
        await callback(relativePath, fullPath);
      }
    }
  } catch (error) {
    // Ignore permission errors
    if (error.code !== 'EACCES' && error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Search for files matching a glob pattern
 */
async function searchFiles(args) {
  const pattern = args.pattern;
  const cwd = args.cwd || process.cwd();
  const maxResults = args.maxResults || 100;

  if (!pattern) {
    return 'Error: pattern is required';
  }

  try {
    const resolvedCwd = path.resolve(cwd);
    const regex = globToRegex(pattern);
    const matches = [];

    await walkDir(resolvedCwd, async (relativePath) => {
      if (matches.length >= maxResults) return;

      // Normalize path separators for matching
      const normalizedPath = relativePath.replace(/\\/g, '/');
      if (regex.test(normalizedPath)) {
        matches.push(relativePath);
      }
    });

    if (matches.length === 0) {
      return `No files found matching pattern: ${pattern}`;
    }

    const result = matches.join('\n');
    const suffix = matches.length >= maxResults ? `\n\n(Limited to ${maxResults} results)` : '';

    return `Found ${matches.length} files:\n\n${result}${suffix}`;
  } catch (error) {
    return `Error searching files: ${error.message}`;
  }
}

/**
 * Search for content within files
 */
async function grepContent(args) {
  const pattern = args.pattern;
  const glob = args.glob || '**/*';
  const cwd = args.cwd || process.cwd();
  const caseSensitive = args.caseSensitive || false;
  const maxResults = args.maxResults || 50;

  if (!pattern) {
    return 'Error: pattern is required';
  }

  try {
    const resolvedCwd = path.resolve(cwd);
    const globRegex = globToRegex(glob);
    const searchRegex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
    const matches = [];

    await walkDir(resolvedCwd, async (relativePath, fullPath) => {
      if (matches.length >= maxResults) return;

      // Check if file matches glob pattern
      const normalizedPath = relativePath.replace(/\\/g, '/');
      if (!globRegex.test(normalizedPath)) return;

      // Skip binary files by extension
      const ext = path.extname(fullPath).toLowerCase();
      const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz', '.exe', '.dll', '.so', '.dylib'];
      if (binaryExts.includes(ext)) return;

      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          if (matches.length >= maxResults) break;

          const line = lines[i];
          if (searchRegex.test(line)) {
            matches.push({
              file: relativePath,
              line: i + 1,
              content: line.trim().slice(0, 200), // Limit line length
            });
            // Reset regex state
            searchRegex.lastIndex = 0;
          }
        }
      } catch {
        // Skip files that can't be read as text
      }
    });

    if (matches.length === 0) {
      return `No matches found for pattern: ${pattern}`;
    }

    const lines = matches.map(
      (m) => `${m.file}:${m.line}: ${m.content}`
    );
    const suffix = matches.length >= maxResults ? `\n\n(Limited to ${maxResults} results)` : '';

    return `Found ${matches.length} matches:\n\n${lines.join('\n')}${suffix}`;
  } catch (error) {
    return `Error searching content: ${error.message}`;
  }
}

module.exports = {
  searchFiles,
  grepContent,
};
