import CDP from "chrome-remote-interface";

export interface DatabaseWithObjectStores {
  name: string;
  version: number;
  objectStores: ObjectStore[];
}

export interface ObjectStore {
  name: string;
  keyPath: KeyPath;
  autoIncrement: boolean;
  indexes: ObjectStoreIndex[];
}

export interface ObjectStoreIndex {
  name: string;
  keyPath: KeyPath;
  unique: boolean;
  multiEntry: boolean;
}

export interface KeyPath {
  type: "null" | "string" | "array";
  string?: string;
  array?: string[];
}

export interface Key {
  type: "number" | "string" | "date" | "array";
  number?: number;
  string?: string;
  date?: number;
  array?: Key[];
}

export interface KeyRange {
  lower?: Key;
  upper?: Key;
  lowerOpen: boolean;
  upperOpen: boolean;
}

export interface IndexedDBDataEntry {
  key: any;
  primaryKey: any;
  value: any;
}

export class IndexedDBDomain {
  constructor(private getClient: () => CDP.Client) {}

  /**
   * Enable IndexedDB domain
   */
  async enable(): Promise<void> {
    const client = this.getClient();
    await (client as any).IndexedDB.enable();
  }

  /**
   * Disable IndexedDB domain
   */
  async disable(): Promise<void> {
    const client = this.getClient();
    await (client as any).IndexedDB.disable();
  }

  /**
   * Request database names
   */
  async requestDatabaseNames(options: {
    securityOrigin?: string;
    storageKey?: string;
    storageBucket?: { storageKey: string; name?: string };
  }): Promise<{ databaseNames: string[] }> {
    const client = this.getClient();
    return (client as any).IndexedDB.requestDatabaseNames(options);
  }

  /**
   * Request database
   */
  async requestDatabase(options: {
    securityOrigin?: string;
    storageKey?: string;
    storageBucket?: { storageKey: string; name?: string };
    databaseName: string;
  }): Promise<{ databaseWithObjectStores: DatabaseWithObjectStores }> {
    const client = this.getClient();
    return (client as any).IndexedDB.requestDatabase(options);
  }

  /**
   * Request data
   */
  async requestData(options: {
    securityOrigin?: string;
    storageKey?: string;
    storageBucket?: { storageKey: string; name?: string };
    databaseName: string;
    objectStoreName: string;
    indexName: string;
    skipCount: number;
    pageSize: number;
    keyRange?: KeyRange;
  }): Promise<{ objectStoreDataEntries: IndexedDBDataEntry[]; hasMore: boolean }> {
    const client = this.getClient();
    return (client as any).IndexedDB.requestData(options);
  }

  /**
   * Get metadata
   */
  async getMetadata(options: {
    securityOrigin?: string;
    storageKey?: string;
    storageBucket?: { storageKey: string; name?: string };
    databaseName: string;
    objectStoreName: string;
  }): Promise<{ entriesCount: number; keyGeneratorValue: number }> {
    const client = this.getClient();
    return (client as any).IndexedDB.getMetadata(options);
  }

  /**
   * Clear object store
   */
  async clearObjectStore(options: {
    securityOrigin?: string;
    storageKey?: string;
    storageBucket?: { storageKey: string; name?: string };
    databaseName: string;
    objectStoreName: string;
  }): Promise<void> {
    const client = this.getClient();
    await (client as any).IndexedDB.clearObjectStore(options);
  }

  /**
   * Delete database
   */
  async deleteDatabase(options: {
    securityOrigin?: string;
    storageKey?: string;
    storageBucket?: { storageKey: string; name?: string };
    databaseName: string;
  }): Promise<void> {
    const client = this.getClient();
    await (client as any).IndexedDB.deleteDatabase(options);
  }

  /**
   * Delete object store entries
   */
  async deleteObjectStoreEntries(options: {
    securityOrigin?: string;
    storageKey?: string;
    storageBucket?: { storageKey: string; name?: string };
    databaseName: string;
    objectStoreName: string;
    keyRange: KeyRange;
  }): Promise<void> {
    const client = this.getClient();
    await (client as any).IndexedDB.deleteObjectStoreEntries(options);
  }
}
