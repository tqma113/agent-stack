import CDP from "chrome-remote-interface";

export interface Bounds {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  windowState?: "normal" | "minimized" | "maximized" | "fullscreen";
}

export interface PermissionDescriptor {
  name: string;
  sysex?: boolean;
  userVisibleOnly?: boolean;
  allowWithoutSanitization?: boolean;
  allowWithoutGesture?: boolean;
  panTiltZoom?: boolean;
}

export interface Bucket {
  low: number;
  high: number;
  count: number;
}

export interface Histogram {
  name: string;
  sum: number;
  count: number;
  buckets: Bucket[];
}

export class BrowserDomain {
  constructor(private getClient: () => CDP.Client) {}

  /**
   * Set permission
   */
  async setPermission(options: {
    permission: PermissionDescriptor;
    setting: "granted" | "denied" | "prompt";
    origin?: string;
    browserContextId?: string;
  }): Promise<void> {
    const client = this.getClient();
    await (client as any).Browser.setPermission(options);
  }

  /**
   * Grant permissions
   */
  async grantPermissions(options: {
    permissions: string[];
    origin?: string;
    browserContextId?: string;
  }): Promise<void> {
    const client = this.getClient();
    await (client as any).Browser.grantPermissions(options);
  }

  /**
   * Reset permissions
   */
  async resetPermissions(browserContextId?: string): Promise<void> {
    const client = this.getClient();
    await (client as any).Browser.resetPermissions({ browserContextId });
  }

  /**
   * Set download behavior
   */
  async setDownloadBehavior(options: {
    behavior: "deny" | "allow" | "allowAndName" | "default";
    browserContextId?: string;
    downloadPath?: string;
    eventsEnabled?: boolean;
  }): Promise<void> {
    const client = this.getClient();
    await (client as any).Browser.setDownloadBehavior(options);
  }

  /**
   * Cancel download
   */
  async cancelDownload(guid: string, browserContextId?: string): Promise<void> {
    const client = this.getClient();
    await (client as any).Browser.cancelDownload({ guid, browserContextId });
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    const client = this.getClient();
    await (client as any).Browser.close();
  }

  /**
   * Crash browser
   */
  async crash(): Promise<void> {
    const client = this.getClient();
    await (client as any).Browser.crash();
  }

  /**
   * Crash GPU process
   */
  async crashGpuProcess(): Promise<void> {
    const client = this.getClient();
    await (client as any).Browser.crashGpuProcess();
  }

  /**
   * Get version
   */
  async getVersion(): Promise<{
    protocolVersion: string;
    product: string;
    revision: string;
    userAgent: string;
    jsVersion: string;
  }> {
    const client = this.getClient();
    return (client as any).Browser.getVersion();
  }

  /**
   * Get browser command line
   */
  async getBrowserCommandLine(): Promise<{ arguments: string[] }> {
    const client = this.getClient();
    return (client as any).Browser.getBrowserCommandLine();
  }

  /**
   * Get histograms
   */
  async getHistograms(options: { query?: string; delta?: boolean } = {}): Promise<{ histograms: Histogram[] }> {
    const client = this.getClient();
    return (client as any).Browser.getHistograms(options);
  }

  /**
   * Get histogram
   */
  async getHistogram(name: string, delta?: boolean): Promise<{ histogram: Histogram }> {
    const client = this.getClient();
    return (client as any).Browser.getHistogram({ name, delta });
  }

  /**
   * Get window bounds
   */
  async getWindowBounds(windowId: number): Promise<{ bounds: Bounds }> {
    const client = this.getClient();
    return (client as any).Browser.getWindowBounds({ windowId });
  }

  /**
   * Get window for target
   */
  async getWindowForTarget(targetId?: string): Promise<{ windowId: number; bounds: Bounds }> {
    const client = this.getClient();
    return (client as any).Browser.getWindowForTarget({ targetId });
  }

  /**
   * Set window bounds
   */
  async setWindowBounds(windowId: number, bounds: Bounds): Promise<void> {
    const client = this.getClient();
    await (client as any).Browser.setWindowBounds({ windowId, bounds });
  }

  /**
   * Set dock tile
   */
  async setDockTile(options: { badgeLabel?: string; image?: string } = {}): Promise<void> {
    const client = this.getClient();
    await (client as any).Browser.setDockTile(options);
  }

  /**
   * Execute browser command
   */
  async executeBrowserCommand(commandId: string): Promise<void> {
    const client = this.getClient();
    await (client as any).Browser.executeBrowserCommand({ commandId });
  }

  /**
   * Add privacy sandbox enrollment override
   */
  async addPrivacySandboxEnrollmentOverride(url: string): Promise<void> {
    const client = this.getClient();
    await (client as any).Browser.addPrivacySandboxEnrollmentOverride({ url });
  }

  /**
   * Listen for download will begin
   */
  onDownloadWillBegin(callback: (params: {
    frameId: string;
    guid: string;
    url: string;
    suggestedFilename: string;
  }) => void): void {
    const client = this.getClient();
    (client as any).Browser.on("downloadWillBegin", callback);
  }

  /**
   * Listen for download progress
   */
  onDownloadProgress(callback: (params: {
    guid: string;
    totalBytes: number;
    receivedBytes: number;
    state: "inProgress" | "completed" | "canceled";
  }) => void): void {
    const client = this.getClient();
    (client as any).Browser.on("downloadProgress", callback);
  }
}
