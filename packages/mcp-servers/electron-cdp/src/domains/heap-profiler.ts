import CDP from "chrome-remote-interface";

export interface SamplingHeapProfileNode {
  callFrame: {
    functionName: string;
    scriptId: string;
    url: string;
    lineNumber: number;
    columnNumber: number;
  };
  selfSize: number;
  id: number;
  children: SamplingHeapProfileNode[];
}

export interface SamplingHeapProfile {
  head: SamplingHeapProfileNode;
  samples: Array<{ size: number; nodeId: number; ordinal: number }>;
}

export class HeapProfilerDomain {
  constructor(private getClient: () => CDP.Client) {}

  /**
   * Enable heap profiler
   */
  async enable(): Promise<void> {
    const client = this.getClient();
    await (client as any).HeapProfiler.enable();
  }

  /**
   * Disable heap profiler
   */
  async disable(): Promise<void> {
    const client = this.getClient();
    await (client as any).HeapProfiler.disable();
  }

  /**
   * Start tracking heap objects
   */
  async startTrackingHeapObjects(options: {
    trackAllocations?: boolean;
  } = {}): Promise<void> {
    const client = this.getClient();
    await (client as any).HeapProfiler.startTrackingHeapObjects(options);
  }

  /**
   * Stop tracking heap objects
   */
  async stopTrackingHeapObjects(options: {
    reportProgress?: boolean;
    treatGlobalObjectsAsRoots?: boolean;
    captureNumericValue?: boolean;
    exposeInternals?: boolean;
  } = {}): Promise<void> {
    const client = this.getClient();
    await (client as any).HeapProfiler.stopTrackingHeapObjects(options);
  }

  /**
   * Take heap snapshot
   */
  async takeHeapSnapshot(options: {
    reportProgress?: boolean;
    treatGlobalObjectsAsRoots?: boolean;
    captureNumericValue?: boolean;
    exposeInternals?: boolean;
  } = {}): Promise<void> {
    const client = this.getClient();
    await (client as any).HeapProfiler.takeHeapSnapshot(options);
  }

  /**
   * Start sampling heap profiler
   */
  async startSampling(options: {
    samplingInterval?: number;
    includeObjectsCollectedByMajorGC?: boolean;
    includeObjectsCollectedByMinorGC?: boolean;
  } = {}): Promise<void> {
    const client = this.getClient();
    await (client as any).HeapProfiler.startSampling(options);
  }

  /**
   * Stop sampling and get profile
   */
  async stopSampling(): Promise<{ profile: SamplingHeapProfile }> {
    const client = this.getClient();
    return (client as any).HeapProfiler.stopSampling();
  }

  /**
   * Get sampling profile
   */
  async getSamplingProfile(): Promise<{ profile: SamplingHeapProfile }> {
    const client = this.getClient();
    return (client as any).HeapProfiler.getSamplingProfile();
  }

  /**
   * Collect garbage
   */
  async collectGarbage(): Promise<void> {
    const client = this.getClient();
    await (client as any).HeapProfiler.collectGarbage();
  }

  /**
   * Get heap object by ID
   */
  async getHeapObjectId(objectId: string): Promise<{ heapSnapshotObjectId: string }> {
    const client = this.getClient();
    return (client as any).HeapProfiler.getHeapObjectId({ objectId });
  }

  /**
   * Get object by heap object ID
   */
  async getObjectByHeapObjectId(options: {
    objectId: string;
    objectGroup?: string;
  }): Promise<{ result: any }> {
    const client = this.getClient();
    return (client as any).HeapProfiler.getObjectByHeapObjectId(options);
  }

  /**
   * Add inspected heap object
   */
  async addInspectedHeapObject(heapObjectId: string): Promise<void> {
    const client = this.getClient();
    await (client as any).HeapProfiler.addInspectedHeapObject({ heapObjectId });
  }

  /**
   * Listen for heap snapshot chunk
   */
  onAddHeapSnapshotChunk(callback: (params: { chunk: string }) => void): void {
    const client = this.getClient();
    (client as any).HeapProfiler.on("addHeapSnapshotChunk", callback);
  }

  /**
   * Listen for report heap snapshot progress
   */
  onReportHeapSnapshotProgress(callback: (params: { done: number; total: number; finished?: boolean }) => void): void {
    const client = this.getClient();
    (client as any).HeapProfiler.on("reportHeapSnapshotProgress", callback);
  }

  /**
   * Listen for last seen object ID
   */
  onLastSeenObjectId(callback: (params: { lastSeenObjectId: number; timestamp: number }) => void): void {
    const client = this.getClient();
    (client as any).HeapProfiler.on("lastSeenObjectId", callback);
  }

  /**
   * Listen for heap stats update
   */
  onHeapStatsUpdate(callback: (params: { statsUpdate: number[] }) => void): void {
    const client = this.getClient();
    (client as any).HeapProfiler.on("heapStatsUpdate", callback);
  }
}
