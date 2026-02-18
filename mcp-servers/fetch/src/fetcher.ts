/**
 * Web fetching and HTML processing utilities
 */

import { NodeHtmlMarkdown } from 'node-html-markdown';
import type { FetchInput, FetchResult, ServerConfig } from './types.js';
import { FetchError } from './types.js';

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (compatible; MCPFetchBot/1.0; +https://github.com/anthropics/mcp)';

/**
 * HTML to Markdown converter instance
 */
const htmlToMd = new NodeHtmlMarkdown({
  preferNativeParser: false,
  codeFence: '```',
  bulletMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
  strongDelimiter: '**',
  strikeDelimiter: '~~',
});

/**
 * Extract title from HTML
 */
function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch) {
    return titleMatch[1].trim();
  }

  // Try h1 as fallback
  const h1Match = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
  if (h1Match) {
    return h1Match[1].trim();
  }

  return 'Untitled';
}

/**
 * Extract content using CSS selector (basic implementation)
 */
function extractBySelector(html: string, selector: string): string {
  // Simple selector support: tag, .class, #id, tag.class
  let pattern: RegExp;

  if (selector.startsWith('#')) {
    // ID selector
    const id = selector.slice(1);
    pattern = new RegExp(`<[^>]+id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/`, 'i');
  } else if (selector.startsWith('.')) {
    // Class selector
    const className = selector.slice(1);
    pattern = new RegExp(`<[^>]+class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/`, 'i');
  } else if (selector.includes('.')) {
    // Tag.class selector
    const [tag, className] = selector.split('.');
    pattern = new RegExp(`<${tag}[^>]+class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  } else {
    // Tag selector - find first matching tag with content
    pattern = new RegExp(`<${selector}[^>]*>([\\s\\S]*?)<\\/${selector}>`, 'i');
  }

  const match = html.match(pattern);
  if (match) {
    return match[0]; // Return the full matched element
  }

  return html; // Fallback to full HTML
}

/**
 * Clean HTML before conversion
 */
function cleanHtml(html: string): string {
  return html
    // Remove script tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove style tags
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Remove noscript
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
    // Remove svg
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
    // Remove nav (usually not main content)
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    // Remove footer
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    // Remove header (navigation header, not article header)
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '');
}

/**
 * Check if domain is allowed
 */
function isDomainAllowed(
  url: string,
  allowedDomains?: string[],
  blockedDomains?: string[]
): boolean {
  try {
    const { hostname } = new URL(url);

    // Check blocked domains first
    if (blockedDomains && blockedDomains.length > 0) {
      for (const blocked of blockedDomains) {
        if (hostname === blocked || hostname.endsWith(`.${blocked}`)) {
          return false;
        }
      }
    }

    // If allowed domains specified, check against them
    if (allowedDomains && allowedDomains.length > 0) {
      for (const allowed of allowedDomains) {
        if (hostname === allowed || hostname.endsWith(`.${allowed}`)) {
          return true;
        }
      }
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch and process a URL
 */
export async function fetchUrl(
  input: FetchInput,
  config: ServerConfig = {}
): Promise<FetchResult> {
  const {
    url,
    maxLength = config.defaultMaxLength || 50000,
    timeout = config.defaultTimeout || 30000,
    userAgent = config.defaultUserAgent || DEFAULT_USER_AGENT,
    selector,
    raw = false,
  } = input;

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new FetchError('Invalid URL format', 'INVALID_URL', undefined, url);
  }

  // Check protocol
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new FetchError(
      `Unsupported protocol: ${parsedUrl.protocol}`,
      'UNSUPPORTED_PROTOCOL',
      undefined,
      url
    );
  }

  // Check domain restrictions
  if (!isDomainAllowed(url, config.allowedDomains, config.blockedDomains)) {
    throw new FetchError(
      `Domain not allowed: ${parsedUrl.hostname}`,
      'DOMAIN_BLOCKED',
      undefined,
      url
    );
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new FetchError(
        `HTTP error: ${response.status} ${response.statusText}`,
        'HTTP_ERROR',
        response.status,
        url
      );
    }

    const contentType = response.headers.get('content-type') || 'text/html';

    // Check if response is HTML
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      // For non-HTML, return raw content
      const text = await response.text();
      const truncated = text.length > maxLength;
      const content = truncated ? text.slice(0, maxLength) + '\n\n[Content truncated]' : text;

      return {
        url,
        finalUrl: response.url,
        title: 'Non-HTML Content',
        content,
        contentLength: content.length,
        truncated,
        contentType,
        statusCode: response.status,
      };
    }

    // Get HTML content
    let html = await response.text();

    // Extract title before cleaning
    const title = extractTitle(html);

    // Apply selector if specified
    if (selector) {
      html = extractBySelector(html, selector);
    }

    // Clean HTML
    html = cleanHtml(html);

    // Convert to Markdown or return raw
    let content: string;
    if (raw) {
      content = html;
    } else {
      content = htmlToMd.translate(html);
      // Clean up excessive whitespace
      content = content
        .replace(/\n{3,}/g, '\n\n')
        .replace(/^\s+|\s+$/g, '');
    }

    // Truncate if needed
    const truncated = content.length > maxLength;
    if (truncated) {
      content = content.slice(0, maxLength) + '\n\n[Content truncated]';
    }

    return {
      url,
      finalUrl: response.url,
      title,
      content,
      contentLength: content.length,
      truncated,
      contentType,
      statusCode: response.status,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof FetchError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new FetchError(
          `Request timed out after ${timeout}ms`,
          'TIMEOUT',
          undefined,
          url
        );
      }
      throw new FetchError(error.message, 'FETCH_ERROR', undefined, url);
    }

    throw new FetchError('Unknown fetch error', 'UNKNOWN_ERROR', undefined, url);
  }
}
