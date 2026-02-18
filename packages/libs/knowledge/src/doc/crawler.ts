/**
 * Document Crawler
 *
 * Fetches web pages and converts to Markdown.
 */

import type { CrawlOptions, DocPage, DocSection } from '../types.js';
import { CrawlError } from '../errors.js';
import { createParser, type ParserInstance } from './parser.js';
import { createHash } from 'crypto';

/**
 * Default crawl options
 */
const DEFAULT_CRAWL_OPTIONS: Required<CrawlOptions> = {
  maxPages: 100,
  maxDepth: 3,
  includePatterns: [],
  excludePatterns: [],
  delayMs: 500,
  timeoutMs: 30000,
  headers: {},
  followRedirects: true,
  contentSelector: undefined as unknown as string,
  excludeSelectors: [],
};

/**
 * Crawler instance interface
 */
export interface CrawlerInstance {
  /** Fetch a single URL */
  fetch(url: string, options?: CrawlOptions): Promise<DocPage>;

  /** Crawl a sitemap */
  crawlSitemap(sitemapUrl: string, options?: CrawlOptions): AsyncGenerator<DocPage>;

  /** Crawl recursively from a starting URL */
  crawlRecursive(startUrl: string, options?: CrawlOptions): AsyncGenerator<DocPage>;

  /** Stop crawling */
  stop(): void;
}

/**
 * Crawler configuration
 */
export interface CrawlerConfig {
  /** User agent string */
  userAgent: string;
  /** Parser instance */
  parser?: ParserInstance;
}

const DEFAULT_CRAWLER_CONFIG: CrawlerConfig = {
  userAgent: 'AI-Stack-Bot/1.0',
};

/**
 * Generate unique page ID
 */
function generatePageId(url: string): string {
  return createHash('sha256').update(url).digest('hex').substring(0, 16);
}

/**
 * Compute content hash
 */
function computeContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Extract title from HTML
 */
function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    return titleMatch[1].trim();
  }

  // Try h1
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) {
    return h1Match[1].trim();
  }

  return 'Untitled';
}

/**
 * Extract links from HTML
 */
function extractLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const linkPattern = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;

  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    const href = match[1];

    // Skip anchors, javascript, mailto, etc.
    if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      continue;
    }

    try {
      const fullUrl = new URL(href, baseUrl).toString();
      // Only include same-origin links
      const base = new URL(baseUrl);
      const link = new URL(fullUrl);
      if (link.origin === base.origin) {
        links.push(fullUrl.split('#')[0]); // Remove hash
      }
    } catch {
      // Invalid URL, skip
    }
  }

  // Deduplicate
  return [...new Set(links)];
}

/**
 * Check if URL matches patterns
 */
function matchesPatterns(url: string, includePatterns: string[], excludePatterns: string[]): boolean {
  // Check exclude patterns first
  for (const pattern of excludePatterns) {
    if (url.includes(pattern) || new RegExp(pattern).test(url)) {
      return false;
    }
  }

  // If no include patterns, allow all
  if (includePatterns.length === 0) {
    return true;
  }

  // Check include patterns
  for (const pattern of includePatterns) {
    if (url.includes(pattern) || new RegExp(pattern).test(url)) {
      return true;
    }
  }

  return false;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a document crawler
 */
export function createCrawler(config: Partial<CrawlerConfig> = {}): CrawlerInstance {
  const cfg: CrawlerConfig = { ...DEFAULT_CRAWLER_CONFIG, ...config };
  const parser = cfg.parser || createParser();

  let stopped = false;

  /**
   * Fetch a single URL
   */
  async function fetch(url: string, options?: CrawlOptions): Promise<DocPage> {
    const opts = { ...DEFAULT_CRAWL_OPTIONS, ...options };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs);

      const response = await globalThis.fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': cfg.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          ...opts.headers,
        },
        redirect: opts.followRedirects ? 'follow' : 'manual',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new CrawlError(`HTTP ${response.status}: ${response.statusText}`, url, response.status);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        throw new CrawlError(`Unsupported content type: ${contentType}`, url);
      }

      const html = await response.text();
      const title = extractTitle(html);

      // Parse HTML to Markdown
      const { markdown, sections } = parser.parse(html, url);

      const page: DocPage = {
        id: generatePageId(url),
        sourceId: '', // Will be set by indexer
        url,
        title,
        content: markdown,
        sections,
        fetchedAt: Date.now(),
        contentHash: computeContentHash(markdown),
      };

      return page;
    } catch (error) {
      if (error instanceof CrawlError) {
        throw error;
      }
      throw new CrawlError(`Failed to fetch: ${(error as Error).message}`, url, undefined, error as Error);
    }
  }

  /**
   * Parse sitemap XML
   */
  function parseSitemap(xml: string): string[] {
    const urls: string[] = [];

    // Extract URLs from sitemap
    const locPattern = /<loc>([^<]+)<\/loc>/gi;
    let match;
    while ((match = locPattern.exec(xml)) !== null) {
      urls.push(match[1].trim());
    }

    return urls;
  }

  /**
   * Crawl a sitemap
   */
  async function* crawlSitemap(sitemapUrl: string, options?: CrawlOptions): AsyncGenerator<DocPage> {
    const opts = { ...DEFAULT_CRAWL_OPTIONS, ...options };
    stopped = false;

    try {
      // Fetch sitemap
      const response = await globalThis.fetch(sitemapUrl, {
        headers: {
          'User-Agent': cfg.userAgent,
        },
      });

      if (!response.ok) {
        throw new CrawlError(`Failed to fetch sitemap: HTTP ${response.status}`, sitemapUrl, response.status);
      }

      const xml = await response.text();
      let urls = parseSitemap(xml);

      // Filter URLs
      urls = urls.filter((url) => matchesPatterns(url, opts.includePatterns || [], opts.excludePatterns || []));

      // Limit pages
      urls = urls.slice(0, opts.maxPages);

      // Crawl each URL
      for (const url of urls) {
        if (stopped) break;

        try {
          const page = await fetch(url, options);
          yield page;
        } catch (error) {
          console.warn(`[Crawler] Failed to fetch ${url}:`, (error as Error).message);
        }

        // Delay between requests
        if (opts.delayMs > 0) {
          await sleep(opts.delayMs);
        }
      }
    } catch (error) {
      throw new CrawlError(`Sitemap crawl failed: ${(error as Error).message}`, sitemapUrl, undefined, error as Error);
    }
  }

  /**
   * Crawl recursively
   */
  async function* crawlRecursive(startUrl: string, options?: CrawlOptions): AsyncGenerator<DocPage> {
    const opts = { ...DEFAULT_CRAWL_OPTIONS, ...options };
    stopped = false;

    const visited = new Set<string>();
    const queue: Array<{ url: string; depth: number }> = [{ url: startUrl, depth: 0 }];

    while (queue.length > 0 && !stopped) {
      const { url, depth } = queue.shift()!;

      // Skip if already visited or exceeds max pages
      if (visited.has(url) || visited.size >= opts.maxPages) {
        continue;
      }

      // Skip if doesn't match patterns
      if (!matchesPatterns(url, opts.includePatterns || [], opts.excludePatterns || [])) {
        continue;
      }

      visited.add(url);

      try {
        // Fetch the page
        const response = await globalThis.fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': cfg.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            ...opts.headers,
          },
          redirect: opts.followRedirects ? 'follow' : 'manual',
        });

        if (!response.ok) {
          console.warn(`[Crawler] HTTP ${response.status} for ${url}`);
          continue;
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
          continue;
        }

        const html = await response.text();
        const title = extractTitle(html);
        const { markdown, sections } = parser.parse(html, url);

        const page: DocPage = {
          id: generatePageId(url),
          sourceId: '',
          url,
          title,
          content: markdown,
          sections,
          fetchedAt: Date.now(),
          contentHash: computeContentHash(markdown),
        };

        yield page;

        // Extract links and add to queue (if not at max depth)
        if (depth < opts.maxDepth) {
          const links = extractLinks(html, url);
          for (const link of links) {
            if (!visited.has(link)) {
              queue.push({ url: link, depth: depth + 1 });
            }
          }
        }
      } catch (error) {
        console.warn(`[Crawler] Failed to fetch ${url}:`, (error as Error).message);
      }

      // Delay between requests
      if (opts.delayMs > 0) {
        await sleep(opts.delayMs);
      }
    }
  }

  /**
   * Stop crawling
   */
  function stop(): void {
    stopped = true;
  }

  return {
    fetch,
    crawlSitemap,
    crawlRecursive,
    stop,
  };
}
