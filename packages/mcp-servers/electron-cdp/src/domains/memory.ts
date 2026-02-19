import CDP from "chrome-remote-interface";

export interface SamplingProfileNode {
  size: number;
  total: number;
  stack: string[];
}

export interface SamplingProfile {
  samples: SamplingProfileNode[];
  modules: Module[];
}

export interface Module {
  name: string;
  uuid: string;
  baseAddress: string;
  size: number;
}

export class MemoryDomain {
  constructor(private getClient: () => CDP.Client) {}

  /**
   * Get DOM counters
   */
  async getDOMCounters(): Promise<{ documents: number; nodes: number; jsEventListeners: number }> {
    const client = this.getClient();
    return (client as any).Memory.getDOMCounters();
  }

  /**
   * Prepare for leak detection
   */
  async prepareForLeakDetection(): Promise<void> {
    const client = this.getClient();
    await (client as any).Memory.prepareForLeakDetection();
  }

  /**
   * Force garbage collection
   */
  async forciblyPurgeJavaScriptMemory(): Promise<void> {
    const client = this.getClient();
    await (client as any).Memory.forciblyPurgeJavaScriptMemory();
  }

  /**
   * Set pressure notifications suppressed
   */
  async setPressureNotificationsSuppressed(suppressed: boolean): Promise<void> {
    const client = this.getClient();
    await (client as any).Memory.setPressureNotificationsSuppressed({ suppressed });
  }

  /**
   * Simulate pressure notification
   */
  async simulatePressureNotification(level: "moderate" | "critical"): Promise<void> {
    const client = this.getClient();
    await (client as any).Memory.simulatePressureNotification({ level });
  }

  /**
   * Start sampling
   */
  async startSampling(options: { samplingInterval?: number; suppressRandomness?: boolean } = {}): Promise<void> {
    const client = this.getClient();
    await (client as any).Memory.startSampling(options);
  }

  /**
   * Stop sampling
   */
  async stopSampling(): Promise<void> {
    const client = this.getClient();
    await (client as any).Memory.stopSampling();
  }

  /**
   * Get all time sampling profile
   */
  async getAllTimeSamplingProfile(): Promise<{ profile: SamplingProfile }> {
    const client = this.getClient();
    return (client as any).Memory.getAllTimeSamplingProfile();
  }

  /**
   * Get browser sampling profile
   */
  async getBrowserSamplingProfile(): Promise<{ profile: SamplingProfile }> {
    const client = this.getClient();
    return (client as any).Memory.getBrowserSamplingProfile();
  }

  /**
   * Get sampling profile
   */
  async getSamplingProfile(): Promise<{ profile: SamplingProfile }> {
    const client = this.getClient();
    return (client as any).Memory.getSamplingProfile();
  }
}
