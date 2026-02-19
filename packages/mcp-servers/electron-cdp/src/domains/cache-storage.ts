import CDP from "chrome-remote-interface";

export interface Cache {
  cacheId: string;
  securityOrigin: string;
  storageKey: string;
  storageBucket?: { storageKey: string; name?: string };
  cacheName: string;
}

export interface Header {
  name: string;
  value: string;
}

export interface CachedResponse {
  body: string;
}

export interface CacheDataEntry {
  requestURL: string;
  requestMethod: string;
  requestHeaders: Header[];
  responseTime: number;
  responseStatus: number;
  responseStatusText: string;
  responseType: "basic" | "cors" | "default" | "error" | "opaqueResponse" | "opaqueRedirect";
  responseHeaders: Header[];
}

export class CacheStorageDomain {
  constructor(private getClient: () => CDP.Client) {}

  /**
   * Request cache names
   */
  async requestCacheNames(options: {
    securityOrigin?: string;
    storageKey?: string;
    storageBucket?: { storageKey: string; name?: string };
  }): Promise<{ caches: Cache[] }> {
    const client = this.getClient();
    return (client as any).CacheStorage.requestCacheNames(options);
  }

  /**
   * Request cached response
   */
  async requestCachedResponse(cacheId: string, requestURL: string, requestHeaders: Header[]): Promise<{ response: CachedResponse }> {
    const client = this.getClient();
    return (client as any).CacheStorage.requestCachedResponse({ cacheId, requestURL, requestHeaders });
  }

  /**
   * Request entries
   */
  async requestEntries(options: {
    cacheId: string;
    skipCount?: number;
    pageSize?: number;
    pathFilter?: string;
  }): Promise<{ cacheDataEntries: CacheDataEntry[]; returnCount: number }> {
    const client = this.getClient();
    return (client as any).CacheStorage.requestEntries(options);
  }

  /**
   * Delete cache
   */
  async deleteCache(cacheId: string): Promise<void> {
    const client = this.getClient();
    await (client as any).CacheStorage.deleteCache({ cacheId });
  }

  /**
   * Delete entry
   */
  async deleteEntry(cacheId: string, request: string): Promise<void> {
    const client = this.getClient();
    await (client as any).CacheStorage.deleteEntry({ cacheId, request });
  }
}
