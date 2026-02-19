import CDP from "chrome-remote-interface";

export type StorageType =
  | "appcache"
  | "cookies"
  | "file_systems"
  | "indexeddb"
  | "local_storage"
  | "shader_cache"
  | "websql"
  | "service_workers"
  | "cache_storage"
  | "interest_groups"
  | "shared_storage"
  | "storage_buckets"
  | "all"
  | "other";

export interface UsageForType {
  storageType: StorageType;
  usage: number;
}

export interface StorageBucket {
  storageKey: string;
  name?: string;
}

export class StorageDomain {
  constructor(private getClient: () => CDP.Client) {}

  /**
   * Get storage key for frame
   */
  async getStorageKeyForFrame(frameId: string): Promise<{ storageKey: string }> {
    const client = this.getClient();
    return (client as any).Storage.getStorageKeyForFrame({ frameId });
  }

  /**
   * Clear data for origin
   */
  async clearDataForOrigin(origin: string, storageTypes: string): Promise<void> {
    const client = this.getClient();
    await (client as any).Storage.clearDataForOrigin({ origin, storageTypes });
  }

  /**
   * Clear data for storage key
   */
  async clearDataForStorageKey(storageKey: string, storageTypes: string): Promise<void> {
    const client = this.getClient();
    await (client as any).Storage.clearDataForStorageKey({ storageKey, storageTypes });
  }

  /**
   * Get cookies
   */
  async getCookies(browserContextId?: string): Promise<{ cookies: any[] }> {
    const client = this.getClient();
    return (client as any).Storage.getCookies({ browserContextId });
  }

  /**
   * Set cookies
   */
  async setCookies(cookies: any[], browserContextId?: string): Promise<void> {
    const client = this.getClient();
    await (client as any).Storage.setCookies({ cookies, browserContextId });
  }

  /**
   * Clear cookies
   */
  async clearCookies(browserContextId?: string): Promise<void> {
    const client = this.getClient();
    await (client as any).Storage.clearCookies({ browserContextId });
  }

  /**
   * Get usage and quota
   */
  async getUsageAndQuota(origin: string): Promise<{
    usage: number;
    quota: number;
    overrideActive: boolean;
    usageBreakdown: UsageForType[];
  }> {
    const client = this.getClient();
    return (client as any).Storage.getUsageAndQuota({ origin });
  }

  /**
   * Override quota for origin
   */
  async overrideQuotaForOrigin(origin: string, quotaSize?: number): Promise<void> {
    const client = this.getClient();
    await (client as any).Storage.overrideQuotaForOrigin({ origin, quotaSize });
  }

  /**
   * Track cache storage for origin
   */
  async trackCacheStorageForOrigin(origin: string): Promise<void> {
    const client = this.getClient();
    await (client as any).Storage.trackCacheStorageForOrigin({ origin });
  }

  /**
   * Untrack cache storage for origin
   */
  async untrackCacheStorageForOrigin(origin: string): Promise<void> {
    const client = this.getClient();
    await (client as any).Storage.untrackCacheStorageForOrigin({ origin });
  }

  /**
   * Track cache storage for storage key
   */
  async trackCacheStorageForStorageKey(storageKey: string): Promise<void> {
    const client = this.getClient();
    await (client as any).Storage.trackCacheStorageForStorageKey({ storageKey });
  }

  /**
   * Untrack cache storage for storage key
   */
  async untrackCacheStorageForStorageKey(storageKey: string): Promise<void> {
    const client = this.getClient();
    await (client as any).Storage.untrackCacheStorageForStorageKey({ storageKey });
  }

  /**
   * Track indexed db for origin
   */
  async trackIndexedDBForOrigin(origin: string): Promise<void> {
    const client = this.getClient();
    await (client as any).Storage.trackIndexedDBForOrigin({ origin });
  }

  /**
   * Untrack indexed db for origin
   */
  async untrackIndexedDBForOrigin(origin: string): Promise<void> {
    const client = this.getClient();
    await (client as any).Storage.untrackIndexedDBForOrigin({ origin });
  }

  /**
   * Track indexed db for storage key
   */
  async trackIndexedDBForStorageKey(storageKey: string): Promise<void> {
    const client = this.getClient();
    await (client as any).Storage.trackIndexedDBForStorageKey({ storageKey });
  }

  /**
   * Untrack indexed db for storage key
   */
  async untrackIndexedDBForStorageKey(storageKey: string): Promise<void> {
    const client = this.getClient();
    await (client as any).Storage.untrackIndexedDBForStorageKey({ storageKey });
  }

  /**
   * Get trust tokens
   */
  async getTrustTokens(): Promise<{ tokens: Array<{ issuerOrigin: string; count: number }> }> {
    const client = this.getClient();
    return (client as any).Storage.getTrustTokens();
  }

  /**
   * Clear trust tokens
   */
  async clearTrustTokens(issuerOrigin: string): Promise<{ didDeleteTokens: boolean }> {
    const client = this.getClient();
    return (client as any).Storage.clearTrustTokens({ issuerOrigin });
  }

  /**
   * Listen for cache storage content updated
   */
  onCacheStorageContentUpdated(callback: (params: { origin: string; storageKey: string; bucketId: string; cacheName: string }) => void): void {
    const client = this.getClient();
    (client as any).Storage.on("cacheStorageContentUpdated", callback);
  }

  /**
   * Listen for cache storage list updated
   */
  onCacheStorageListUpdated(callback: (params: { origin: string; storageKey: string; bucketId: string }) => void): void {
    const client = this.getClient();
    (client as any).Storage.on("cacheStorageListUpdated", callback);
  }

  /**
   * Listen for indexed db content updated
   */
  onIndexedDBContentUpdated(callback: (params: { origin: string; storageKey: string; bucketId: string; databaseName: string; objectStoreName: string }) => void): void {
    const client = this.getClient();
    (client as any).Storage.on("indexedDBContentUpdated", callback);
  }

  /**
   * Listen for indexed db list updated
   */
  onIndexedDBListUpdated(callback: (params: { origin: string; storageKey: string; bucketId: string }) => void): void {
    const client = this.getClient();
    (client as any).Storage.on("indexedDBListUpdated", callback);
  }
}
