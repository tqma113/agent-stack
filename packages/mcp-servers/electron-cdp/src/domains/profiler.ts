import CDP from "chrome-remote-interface";

export interface ProfileNode {
  id: number;
  callFrame: {
    functionName: string;
    scriptId: string;
    url: string;
    lineNumber: number;
    columnNumber: number;
  };
  hitCount?: number;
  children?: number[];
  deoptReason?: string;
  positionTicks?: Array<{ line: number; ticks: number }>;
}

export interface Profile {
  nodes: ProfileNode[];
  startTime: number;
  endTime: number;
  samples?: number[];
  timeDeltas?: number[];
}

export interface CoverageRange {
  startOffset: number;
  endOffset: number;
  count: number;
}

export interface FunctionCoverage {
  functionName: string;
  ranges: CoverageRange[];
  isBlockCoverage: boolean;
}

export interface ScriptCoverage {
  scriptId: string;
  url: string;
  functions: FunctionCoverage[];
}

export class ProfilerDomain {
  constructor(private getClient: () => CDP.Client) {}

  /**
   * Enable profiler
   */
  async enable(): Promise<void> {
    const client = this.getClient();
    await (client as any).Profiler.enable();
  }

  /**
   * Disable profiler
   */
  async disable(): Promise<void> {
    const client = this.getClient();
    await (client as any).Profiler.disable();
  }

  /**
   * Start CPU profiling
   */
  async start(): Promise<void> {
    const client = this.getClient();
    await (client as any).Profiler.start();
  }

  /**
   * Stop CPU profiling and get profile
   */
  async stop(): Promise<{ profile: Profile }> {
    const client = this.getClient();
    return (client as any).Profiler.stop();
  }

  /**
   * Set sampling interval
   */
  async setSamplingInterval(interval: number): Promise<void> {
    const client = this.getClient();
    await (client as any).Profiler.setSamplingInterval({ interval });
  }

  /**
   * Start precise coverage collection
   */
  async startPreciseCoverage(options: {
    callCount?: boolean;
    detailed?: boolean;
    allowTriggeredUpdates?: boolean;
  } = {}): Promise<{ timestamp: number }> {
    const client = this.getClient();
    return (client as any).Profiler.startPreciseCoverage(options);
  }

  /**
   * Stop precise coverage collection
   */
  async stopPreciseCoverage(): Promise<void> {
    const client = this.getClient();
    await (client as any).Profiler.stopPreciseCoverage();
  }

  /**
   * Take precise coverage
   */
  async takePreciseCoverage(): Promise<{ result: ScriptCoverage[]; timestamp: number }> {
    const client = this.getClient();
    return (client as any).Profiler.takePreciseCoverage();
  }

  /**
   * Get best effort coverage (no prior startPreciseCoverage needed)
   */
  async getBestEffortCoverage(): Promise<{ result: ScriptCoverage[] }> {
    const client = this.getClient();
    return (client as any).Profiler.getBestEffortCoverage();
  }

  /**
   * Listen for console profile finished
   */
  onConsoleProfileFinished(callback: (params: { id: string; location: any; profile: Profile; title?: string }) => void): void {
    const client = this.getClient();
    (client as any).Profiler.on("consoleProfileFinished", callback);
  }

  /**
   * Listen for console profile started
   */
  onConsoleProfileStarted(callback: (params: { id: string; location: any; title?: string }) => void): void {
    const client = this.getClient();
    (client as any).Profiler.on("consoleProfileStarted", callback);
  }

  /**
   * Listen for precise coverage delta updates
   */
  onPreciseCoverageDeltaUpdate(callback: (params: { timestamp: number; occasion: string; result: ScriptCoverage[] }) => void): void {
    const client = this.getClient();
    (client as any).Profiler.on("preciseCoverageDeltaUpdate", callback);
  }
}
