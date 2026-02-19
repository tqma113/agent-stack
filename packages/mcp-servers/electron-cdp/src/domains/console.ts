import CDP from "chrome-remote-interface";

export interface ConsoleMessage {
  source: "xml" | "javascript" | "network" | "console-api" | "storage" | "appcache" | "rendering" | "security" | "other" | "deprecation" | "worker";
  level: "log" | "warning" | "error" | "debug" | "info";
  text: string;
  url?: string;
  line?: number;
  column?: number;
}

export class ConsoleDomain {
  constructor(private getClient: () => CDP.Client) {}

  /**
   * Enable console domain
   */
  async enable(): Promise<void> {
    const client = this.getClient();
    await (client as any).Console.enable();
  }

  /**
   * Disable console domain
   */
  async disable(): Promise<void> {
    const client = this.getClient();
    await (client as any).Console.disable();
  }

  /**
   * Clear console messages
   */
  async clearMessages(): Promise<void> {
    const client = this.getClient();
    await (client as any).Console.clearMessages();
  }

  /**
   * Listen for message added
   */
  onMessageAdded(callback: (params: { message: ConsoleMessage }) => void): void {
    const client = this.getClient();
    (client as any).Console.on("messageAdded", callback);
  }
}
