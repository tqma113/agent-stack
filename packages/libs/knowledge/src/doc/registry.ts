/**
 * Document Source Registry
 *
 * Manages document sources and their metadata.
 */

import { randomUUID } from 'crypto';
import type { DocSource, DocSourceInput, DocPage, UUID } from '../types.js';

/**
 * Registry instance interface
 */
export interface RegistryInstance {
  /** Add a source */
  addSource(input: DocSourceInput): DocSource;

  /** Get a source */
  getSource(id: UUID): DocSource | undefined;

  /** Get source by URL */
  getSourceByUrl(url: string): DocSource | undefined;

  /** Update a source */
  updateSource(id: UUID, update: Partial<DocSource>): DocSource | undefined;

  /** Remove a source */
  removeSource(id: UUID): boolean;

  /** List all sources */
  listSources(): DocSource[];

  /** Get enabled sources */
  getEnabledSources(): DocSource[];

  /** Add a page */
  addPage(page: DocPage): void;

  /** Get a page */
  getPage(id: UUID): DocPage | undefined;

  /** Get page by URL */
  getPageByUrl(url: string): DocPage | undefined;

  /** Get pages by source */
  getPagesBySource(sourceId: UUID): DocPage[];

  /** Update a page */
  updatePage(id: UUID, update: Partial<DocPage>): DocPage | undefined;

  /** Remove a page */
  removePage(id: UUID): boolean;

  /** Remove pages by source */
  removePagesBySource(sourceId: UUID): number;

  /** List all pages */
  listPages(): DocPage[];

  /** Clear all data */
  clear(): void;

  /** Export data */
  export(): { sources: DocSource[]; pages: DocPage[] };

  /** Import data */
  import(data: { sources: DocSource[]; pages: DocPage[] }): void;
}

/**
 * Create a document registry
 */
export function createRegistry(): RegistryInstance {
  // In-memory storage
  const sources = new Map<UUID, DocSource>();
  const pages = new Map<UUID, DocPage>();
  const urlToSource = new Map<string, UUID>();
  const urlToPage = new Map<string, UUID>();

  /**
   * Add a source
   */
  function addSource(input: DocSourceInput): DocSource {
    const source: DocSource = {
      ...input,
      id: randomUUID(),
      createdAt: Date.now(),
    };

    sources.set(source.id, source);
    urlToSource.set(source.url, source.id);

    return source;
  }

  /**
   * Get a source
   */
  function getSource(id: UUID): DocSource | undefined {
    return sources.get(id);
  }

  /**
   * Get source by URL
   */
  function getSourceByUrl(url: string): DocSource | undefined {
    const id = urlToSource.get(url);
    return id ? sources.get(id) : undefined;
  }

  /**
   * Update a source
   */
  function updateSource(id: UUID, update: Partial<DocSource>): DocSource | undefined {
    const existing = sources.get(id);
    if (!existing) return undefined;

    const updated: DocSource = { ...existing, ...update };

    // Update URL mapping if URL changed
    if (update.url && update.url !== existing.url) {
      urlToSource.delete(existing.url);
      urlToSource.set(update.url, id);
    }

    sources.set(id, updated);
    return updated;
  }

  /**
   * Remove a source
   */
  function removeSource(id: UUID): boolean {
    const source = sources.get(id);
    if (!source) return false;

    // Remove associated pages
    removePagesBySource(id);

    urlToSource.delete(source.url);
    sources.delete(id);
    return true;
  }

  /**
   * List all sources
   */
  function listSources(): DocSource[] {
    return Array.from(sources.values());
  }

  /**
   * Get enabled sources
   */
  function getEnabledSources(): DocSource[] {
    return Array.from(sources.values()).filter((s) => s.enabled);
  }

  /**
   * Add a page
   */
  function addPage(page: DocPage): void {
    pages.set(page.id, page);
    urlToPage.set(page.url, page.id);
  }

  /**
   * Get a page
   */
  function getPage(id: UUID): DocPage | undefined {
    return pages.get(id);
  }

  /**
   * Get page by URL
   */
  function getPageByUrl(url: string): DocPage | undefined {
    const id = urlToPage.get(url);
    return id ? pages.get(id) : undefined;
  }

  /**
   * Get pages by source
   */
  function getPagesBySource(sourceId: UUID): DocPage[] {
    return Array.from(pages.values()).filter((p) => p.sourceId === sourceId);
  }

  /**
   * Update a page
   */
  function updatePage(id: UUID, update: Partial<DocPage>): DocPage | undefined {
    const existing = pages.get(id);
    if (!existing) return undefined;

    const updated: DocPage = { ...existing, ...update };

    // Update URL mapping if URL changed
    if (update.url && update.url !== existing.url) {
      urlToPage.delete(existing.url);
      urlToPage.set(update.url, id);
    }

    pages.set(id, updated);
    return updated;
  }

  /**
   * Remove a page
   */
  function removePage(id: UUID): boolean {
    const page = pages.get(id);
    if (!page) return false;

    urlToPage.delete(page.url);
    pages.delete(id);
    return true;
  }

  /**
   * Remove pages by source
   */
  function removePagesBySource(sourceId: UUID): number {
    const toRemove = Array.from(pages.values())
      .filter((p) => p.sourceId === sourceId)
      .map((p) => p.id);

    for (const id of toRemove) {
      removePage(id);
    }

    return toRemove.length;
  }

  /**
   * List all pages
   */
  function listPages(): DocPage[] {
    return Array.from(pages.values());
  }

  /**
   * Clear all data
   */
  function clear(): void {
    sources.clear();
    pages.clear();
    urlToSource.clear();
    urlToPage.clear();
  }

  /**
   * Export data
   */
  function exportData(): { sources: DocSource[]; pages: DocPage[] } {
    return {
      sources: Array.from(sources.values()),
      pages: Array.from(pages.values()),
    };
  }

  /**
   * Import data
   */
  function importData(data: { sources: DocSource[]; pages: DocPage[] }): void {
    clear();

    for (const source of data.sources) {
      sources.set(source.id, source);
      urlToSource.set(source.url, source.id);
    }

    for (const page of data.pages) {
      pages.set(page.id, page);
      urlToPage.set(page.url, page.id);
    }
  }

  return {
    addSource,
    getSource,
    getSourceByUrl,
    updateSource,
    removeSource,
    listSources,
    getEnabledSources,
    addPage,
    getPage,
    getPageByUrl,
    getPagesBySource,
    updatePage,
    removePage,
    removePagesBySource,
    listPages,
    clear,
    export: exportData,
    import: importData,
  };
}
