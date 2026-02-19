import CDP from "chrome-remote-interface";

export interface TraceConfig {
  recordMode?: "recordUntilFull" | "recordContinuously" | "recordAsMuchAsPossible" | "echoToConsole";
  traceBufferSizeInKb?: number;
  enableSampling?: boolean;
  enableSystrace?: boolean;
  enableArgumentFilter?: boolean;
  includedCategories?: string[];
  excludedCategories?: string[];
  syntheticDelays?: string[];
  memoryDumpConfig?: Record<string, any>;
}

export class TracingDomain {
  constructor(private getClient: () => CDP.Client) {}

  /**
   * Start tracing
   */
  async start(options: {
    categories?: string;
    options?: string;
    bufferUsageReportingInterval?: number;
    transferMode?: "ReportEvents" | "ReturnAsStream";
    streamFormat?: "json" | "proto";
    streamCompression?: "none" | "gzip";
    traceConfig?: TraceConfig;
    perfettoConfig?: string;
    tracingBackend?: "auto" | "chrome" | "system";
  } = {}): Promise<void> {
    const client = this.getClient();
    await (client as any).Tracing.start(options);
  }

  /**
   * Stop tracing and get data
   */
  async end(): Promise<void> {
    const client = this.getClient();
    await (client as any).Tracing.end();
  }

  /**
   * Get available tracing categories
   */
  async getCategories(): Promise<{ categories: string[] }> {
    const client = this.getClient();
    return (client as any).Tracing.getCategories();
  }

  /**
   * Record clock sync marker
   */
  async recordClockSyncMarker(syncId: string): Promise<void> {
    const client = this.getClient();
    await (client as any).Tracing.recordClockSyncMarker({ syncId });
  }

  /**
   * Request memory dump
   */
  async requestMemoryDump(options: {
    deterministic?: boolean;
    levelOfDetail?: "background" | "light" | "detailed";
  } = {}): Promise<{ dumpGuid: string; success: boolean }> {
    const client = this.getClient();
    return (client as any).Tracing.requestMemoryDump(options);
  }

  /**
   * Listen for buffer usage events
   */
  onBufferUsage(callback: (params: { percentFull?: number; eventCount?: number; value?: number }) => void): void {
    const client = this.getClient();
    (client as any).Tracing.on("bufferUsage", callback);
  }

  /**
   * Listen for data collected events
   */
  onDataCollected(callback: (params: { value: any[] }) => void): void {
    const client = this.getClient();
    (client as any).Tracing.on("dataCollected", callback);
  }

  /**
   * Listen for tracing complete events
   */
  onTracingComplete(callback: (params: { dataLossOccurred: boolean; stream?: string; traceFormat?: string; streamCompression?: string }) => void): void {
    const client = this.getClient();
    (client as any).Tracing.on("tracingComplete", callback);
  }
}
