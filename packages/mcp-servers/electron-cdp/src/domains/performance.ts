import CDP from "chrome-remote-interface";

export interface Metric {
  name: string;
  value: number;
}

export class PerformanceDomain {
  constructor(private getClient: () => CDP.Client) {}

  /**
   * Enable performance domain
   */
  async enable(options: {
    timeDomain?: "timeTicks" | "threadTicks";
  } = {}): Promise<void> {
    const client = this.getClient();
    await (client as any).Performance.enable(options);
  }

  /**
   * Disable performance domain
   */
  async disable(): Promise<void> {
    const client = this.getClient();
    await (client as any).Performance.disable();
  }

  /**
   * Get current performance metrics
   */
  async getMetrics(): Promise<{ metrics: Metric[] }> {
    const client = this.getClient();
    return (client as any).Performance.getMetrics();
  }

  /**
   * Set time domain
   */
  async setTimeDomain(timeDomain: "timeTicks" | "threadTicks"): Promise<void> {
    const client = this.getClient();
    await (client as any).Performance.setTimeDomain({ timeDomain });
  }

  /**
   * Listen for metrics events
   */
  onMetrics(callback: (params: { metrics: Metric[]; title: string }) => void): void {
    const client = this.getClient();
    (client as any).Performance.on("metrics", callback);
  }
}
