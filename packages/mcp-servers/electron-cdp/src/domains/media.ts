import CDP from "chrome-remote-interface";

export interface PlayerMessage {
  level: "error" | "warning" | "info" | "debug";
  message: string;
}

export interface PlayerProperty {
  name: string;
  value: string;
}

export interface PlayerEvent {
  timestamp: number;
  value: string;
}

export interface PlayerError {
  errorType: string;
  code: number;
  stack: PlayerErrorSourceLocation[];
  cause: PlayerError[];
  data: any;
}

export interface PlayerErrorSourceLocation {
  file: string;
  line: number;
}

export class MediaDomain {
  constructor(private getClient: () => CDP.Client) {}

  /**
   * Enable media domain
   */
  async enable(): Promise<void> {
    const client = this.getClient();
    await (client as any).Media.enable();
  }

  /**
   * Disable media domain
   */
  async disable(): Promise<void> {
    const client = this.getClient();
    await (client as any).Media.disable();
  }

  /**
   * Listen for player properties changed
   */
  onPlayerPropertiesChanged(callback: (params: { playerId: string; properties: PlayerProperty[] }) => void): void {
    const client = this.getClient();
    (client as any).Media.on("playerPropertiesChanged", callback);
  }

  /**
   * Listen for player events added
   */
  onPlayerEventsAdded(callback: (params: { playerId: string; events: PlayerEvent[] }) => void): void {
    const client = this.getClient();
    (client as any).Media.on("playerEventsAdded", callback);
  }

  /**
   * Listen for player messages logged
   */
  onPlayerMessagesLogged(callback: (params: { playerId: string; messages: PlayerMessage[] }) => void): void {
    const client = this.getClient();
    (client as any).Media.on("playerMessagesLogged", callback);
  }

  /**
   * Listen for player errors raised
   */
  onPlayerErrorsRaised(callback: (params: { playerId: string; errors: PlayerError[] }) => void): void {
    const client = this.getClient();
    (client as any).Media.on("playerErrorsRaised", callback);
  }

  /**
   * Listen for players created
   */
  onPlayersCreated(callback: (params: { players: string[] }) => void): void {
    const client = this.getClient();
    (client as any).Media.on("playersCreated", callback);
  }
}
