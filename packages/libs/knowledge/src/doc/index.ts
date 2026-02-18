/**
 * Document Index Module
 *
 * Exports document indexing functionality.
 */

export { createDocIndexer, type DocIndexerInstance } from './indexer.js';
export { createCrawler, type CrawlerInstance, type CrawlerConfig } from './crawler.js';
export { createParser, type ParserInstance, type ParserConfig } from './parser.js';
export { createRegistry, type RegistryInstance } from './registry.js';
