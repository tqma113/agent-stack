import CDP from "chrome-remote-interface";

export interface LogEntry {
  source: "xml" | "javascript" | "network" | "storage" | "appcache" | "rendering" | "security" | "deprecation" | "worker" | "violation" | "intervention" | "recommendation" | "other";
  level: "verbose" | "info" | "warning" | "error";
  text: string;
  category?: "cors";
  timestamp: number;
  url?: string;
  lineNumber?: number;
  stackTrace?: LogStackTrace;
  networkRequestId?: string;
  workerId?: string;
  args?: any[];
}

export interface LogStackTrace {
  description?: string;
  callFrames: LogCallFrame[];
  parent?: LogStackTrace;
  parentId?: { id: string; debuggerId?: string };
}

export interface LogCallFrame {
  functionName: string;
  scriptId: string;
  url: string;
  lineNumber: number;
  columnNumber: number;
}

export interface ViolationSetting {
  name: "longTask" | "longLayout" | "blockedEvent" | "blockedParser" | "discouragedAPIUse" | "handler" | "recurringHandler";
  threshold: number;
}

export class LogDomain {
  constructor(private getClient: () => CDP.Client) {}

  /**
   * Enable log domain
   */
  async enable(): Promise<void> {
    const client = this.getClient();
    await (client as any).Log.enable();
  }

  /**
   * Disable log domain
   */
  async disable(): Promise<void> {
    const client = this.getClient();
    await (client as any).Log.disable();
  }

  /**
   * Clear log entries
   */
  async clear(): Promise<void> {
    const client = this.getClient();
    await (client as any).Log.clear();
  }

  /**
   * Start violation reporting
   */
  async startViolationsReport(config: ViolationSetting[]): Promise<void> {
    const client = this.getClient();
    await (client as any).Log.startViolationsReport({ config });
  }

  /**
   * Stop violation reporting
   */
  async stopViolationsReport(): Promise<void> {
    const client = this.getClient();
    await (client as any).Log.stopViolationsReport();
  }

  /**
   * Listen for log entry added
   */
  onEntryAdded(callback: (params: { entry: LogEntry }) => void): void {
    const client = this.getClient();
    (client as any).Log.on("entryAdded", callback);
  }
}
