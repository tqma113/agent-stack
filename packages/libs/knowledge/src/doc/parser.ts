/**
 * Document Parser
 *
 * Parses HTML content to Markdown and extracts sections.
 */

import { NodeHtmlMarkdown } from 'node-html-markdown';
import type { DocSection } from '../types.js';
import { ParseError } from '../errors.js';

/**
 * Parser configuration
 */
export interface ParserConfig {
  /** CSS selector for main content */
  contentSelector?: string;
  /** CSS selectors to exclude */
  excludeSelectors?: string[];
  /** Preserve line breaks */
  preserveLineBreaks?: boolean;
}

const DEFAULT_PARSER_CONFIG: ParserConfig = {
  preserveLineBreaks: true,
};

/**
 * Parser instance interface
 */
export interface ParserInstance {
  /** Parse HTML to Markdown */
  parseHtml(html: string, url?: string): string;

  /** Extract sections from Markdown */
  extractSections(markdown: string): DocSection[];

  /** Parse and extract in one step */
  parse(html: string, url?: string): { markdown: string; sections: DocSection[] };
}

/**
 * Create a document parser
 */
export function createParser(config: ParserConfig = {}): ParserInstance {
  const cfg = { ...DEFAULT_PARSER_CONFIG, ...config };

  // Create NodeHtmlMarkdown instance
  const nhm = new NodeHtmlMarkdown({
    keepDataImages: false,
    useLinkReferenceDefinitions: false,
    useInlineLinks: true,
  });

  /**
   * Clean HTML before parsing
   */
  function cleanHtml(html: string): string {
    let cleaned = html;

    // Remove script and style tags
    cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Remove common non-content elements
    const removePatterns = [
      /<nav\b[^>]*>[\s\S]*?<\/nav>/gi,
      /<header\b[^>]*>[\s\S]*?<\/header>/gi,
      /<footer\b[^>]*>[\s\S]*?<\/footer>/gi,
      /<aside\b[^>]*>[\s\S]*?<\/aside>/gi,
      /<!--[\s\S]*?-->/g,
    ];

    for (const pattern of removePatterns) {
      cleaned = cleaned.replace(pattern, '');
    }

    // Apply custom exclude selectors (simplified - would need proper DOM parsing)
    if (cfg.excludeSelectors) {
      for (const selector of cfg.excludeSelectors) {
        // Simple class-based removal
        if (selector.startsWith('.')) {
          const className = selector.slice(1);
          const classPattern = new RegExp(`<[^>]+class="[^"]*\\b${className}\\b[^"]*"[^>]*>[\\s\\S]*?<\\/[^>]+>`, 'gi');
          cleaned = cleaned.replace(classPattern, '');
        }
        // Simple id-based removal
        if (selector.startsWith('#')) {
          const id = selector.slice(1);
          const idPattern = new RegExp(`<[^>]+id="${id}"[^>]*>[\\s\\S]*?<\\/[^>]+>`, 'gi');
          cleaned = cleaned.replace(idPattern, '');
        }
      }
    }

    return cleaned;
  }

  /**
   * Extract content using selector (simplified)
   */
  function extractContent(html: string): string {
    if (!cfg.contentSelector) {
      return html;
    }

    // Simple extraction for common selectors
    const selector = cfg.contentSelector;

    // Handle tag selectors
    if (/^[a-z]+$/i.test(selector)) {
      const match = html.match(new RegExp(`<${selector}[^>]*>([\\s\\S]*?)<\\/${selector}>`, 'i'));
      return match ? match[1] : html;
    }

    // Handle class selectors
    if (selector.startsWith('.')) {
      const className = selector.slice(1);
      const match = html.match(new RegExp(`<[^>]+class="[^"]*\\b${className}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i'));
      return match ? match[1] : html;
    }

    // Handle id selectors
    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      const match = html.match(new RegExp(`<[^>]+id="${id}"[^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i'));
      return match ? match[1] : html;
    }

    return html;
  }

  /**
   * Parse HTML to Markdown
   */
  function parseHtml(html: string, url?: string): string {
    try {
      // Clean HTML
      let cleaned = cleanHtml(html);

      // Extract main content
      cleaned = extractContent(cleaned);

      // Convert to Markdown
      let markdown = nhm.translate(cleaned);

      // Clean up markdown
      markdown = markdown
        // Remove excessive whitespace
        .replace(/\n{3,}/g, '\n\n')
        // Remove empty links
        .replace(/\[([^\]]*)\]\(\s*\)/g, '$1')
        // Fix broken links
        .replace(/\[([^\]]*)\]\((?!http|\/|#)([^)]+)\)/g, (_, text, href) => {
          if (url) {
            try {
              const baseUrl = new URL(url);
              const fullUrl = new URL(href, baseUrl).toString();
              return `[${text}](${fullUrl})`;
            } catch {
              return text;
            }
          }
          return text;
        })
        .trim();

      return markdown;
    } catch (error) {
      throw new ParseError(`Failed to parse HTML: ${(error as Error).message}`, url, error as Error);
    }
  }

  /**
   * Extract sections from Markdown
   */
  function extractSections(markdown: string): DocSection[] {
    const sections: DocSection[] = [];
    const lines = markdown.split('\n');

    // Find headers
    const headers: Array<{ line: number; level: number; title: string; offset: number }> = [];
    let offset = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^(#{1,6})\s+(.+)$/);

      if (match) {
        headers.push({
          line: i,
          level: match[1].length,
          title: match[2].trim(),
          offset,
        });
      }

      offset += line.length + 1; // +1 for newline
    }

    // If no headers, return entire content as single section
    if (headers.length === 0) {
      sections.push({
        id: 'main',
        title: 'Main',
        level: 1,
        content: markdown,
        startOffset: 0,
        endOffset: markdown.length,
      });
      return sections;
    }

    // Create sections from headers
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      const nextHeader = headers[i + 1];

      const startLine = header.line;
      const endLine = nextHeader ? nextHeader.line - 1 : lines.length - 1;

      const sectionLines = lines.slice(startLine, endLine + 1);
      const content = sectionLines.join('\n').trim();

      // Generate anchor ID
      const id = header.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const endOffset = nextHeader ? nextHeader.offset - 1 : markdown.length;

      sections.push({
        id,
        title: header.title,
        level: header.level,
        content,
        startOffset: header.offset,
        endOffset,
      });
    }

    return sections;
  }

  /**
   * Parse and extract in one step
   */
  function parse(html: string, url?: string): { markdown: string; sections: DocSection[] } {
    const markdown = parseHtml(html, url);
    const sections = extractSections(markdown);
    return { markdown, sections };
  }

  return {
    parseHtml,
    extractSections,
    parse,
  };
}
