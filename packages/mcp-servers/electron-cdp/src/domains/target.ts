import CDP from "chrome-remote-interface";

export interface TargetInfo {
  targetId: string;
  type: string;
  title: string;
  url: string;
  attached: boolean;
  openerId?: string;
  canAccessOpener: boolean;
  openerFrameId?: string;
  browserContextId?: string;
  subtype?: string;
}

export interface RemoteLocation {
  host: string;
  port: number;
}

export class TargetDomain {
  constructor(private getClient: () => CDP.Client) {}

  /**
   * Activates (focuses) the target
   */
  async activateTarget(targetId: string): Promise<void> {
    const client = this.getClient();
    await (client as any).Target.activateTarget({ targetId });
  }

  /**
   * Attaches to the target with given id
   */
  async attachToTarget(targetId: string, flatten?: boolean): Promise<{ sessionId: string }> {
    const client = this.getClient();
    return (client as any).Target.attachToTarget({ targetId, flatten });
  }

  /**
   * Attaches to the browser target
   */
  async attachToBrowserTarget(): Promise<{ sessionId: string }> {
    const client = this.getClient();
    return (client as any).Target.attachToBrowserTarget();
  }

  /**
   * Closes the target
   */
  async closeTarget(targetId: string): Promise<{ success: boolean }> {
    const client = this.getClient();
    return (client as any).Target.closeTarget({ targetId });
  }

  /**
   * Creates a new target
   */
  async createTarget(options: {
    url: string;
    width?: number;
    height?: number;
    browserContextId?: string;
    enableBeginFrameControl?: boolean;
    newWindow?: boolean;
    background?: boolean;
    forTab?: boolean;
  }): Promise<{ targetId: string }> {
    const client = this.getClient();
    return (client as any).Target.createTarget(options);
  }

  /**
   * Create browser context
   */
  async createBrowserContext(options: {
    disposeOnDetach?: boolean;
    proxyServer?: string;
    proxyBypassList?: string;
    originsWithUniversalNetworkAccess?: string[];
  } = {}): Promise<{ browserContextId: string }> {
    const client = this.getClient();
    return (client as any).Target.createBrowserContext(options);
  }

  /**
   * Returns all browser contexts created with Target.createBrowserContext method
   */
  async getBrowserContexts(): Promise<{ browserContextIds: string[] }> {
    const client = this.getClient();
    return (client as any).Target.getBrowserContexts();
  }

  /**
   * Detaches session with given id
   */
  async detachFromTarget(options: { sessionId?: string; targetId?: string } = {}): Promise<void> {
    const client = this.getClient();
    await (client as any).Target.detachFromTarget(options);
  }

  /**
   * Deletes a browser context
   */
  async disposeBrowserContext(browserContextId: string): Promise<void> {
    const client = this.getClient();
    await (client as any).Target.disposeBrowserContext({ browserContextId });
  }

  /**
   * Returns information about a target
   */
  async getTargetInfo(targetId?: string): Promise<{ targetInfo: TargetInfo }> {
    const client = this.getClient();
    return (client as any).Target.getTargetInfo({ targetId });
  }

  /**
   * Retrieves a list of available targets
   */
  async getTargets(options: { filter?: Array<{ type?: string; exclude?: boolean }> } = {}): Promise<{ targetInfos: TargetInfo[] }> {
    const client = this.getClient();
    return (client as any).Target.getTargets(options);
  }

  /**
   * Sends protocol message over session with given id
   */
  async sendMessageToTarget(options: { message: string; sessionId?: string; targetId?: string }): Promise<void> {
    const client = this.getClient();
    await (client as any).Target.sendMessageToTarget(options);
  }

  /**
   * Controls whether to automatically attach to new targets
   */
  async setAutoAttach(options: {
    autoAttach: boolean;
    waitForDebuggerOnStart: boolean;
    flatten?: boolean;
    filter?: Array<{ type?: string; exclude?: boolean }>;
  }): Promise<void> {
    const client = this.getClient();
    await (client as any).Target.setAutoAttach(options);
  }

  /**
   * Adds the specified target to the list of targets that will be monitored for any related target creation
   */
  async autoAttachRelated(targetId: string, waitForDebuggerOnStart: boolean, filter?: Array<{ type?: string; exclude?: boolean }>): Promise<void> {
    const client = this.getClient();
    await (client as any).Target.autoAttachRelated({ targetId, waitForDebuggerOnStart, filter });
  }

  /**
   * Controls whether to discover available targets and notify via targetCreated/targetInfoChanged/targetDestroyed events
   */
  async setDiscoverTargets(options: { discover: boolean; filter?: Array<{ type?: string; exclude?: boolean }> }): Promise<void> {
    const client = this.getClient();
    await (client as any).Target.setDiscoverTargets(options);
  }

  /**
   * Enables target discovery for the specified locations
   */
  async setRemoteLocations(locations: RemoteLocation[]): Promise<void> {
    const client = this.getClient();
    await (client as any).Target.setRemoteLocations({ locations });
  }

  /**
   * Inject object to the target's main frame that provides a communication channel with browser target
   */
  async exposeDevToolsProtocol(targetId: string, bindingName?: string): Promise<void> {
    const client = this.getClient();
    await (client as any).Target.exposeDevToolsProtocol({ targetId, bindingName });
  }

  /**
   * Listen for target attached
   */
  onAttachedToTarget(callback: (params: { sessionId: string; targetInfo: TargetInfo; waitingForDebugger: boolean }) => void): void {
    const client = this.getClient();
    (client as any).Target.on("attachedToTarget", callback);
  }

  /**
   * Listen for target detached
   */
  onDetachedFromTarget(callback: (params: { sessionId: string; targetId?: string }) => void): void {
    const client = this.getClient();
    (client as any).Target.on("detachedFromTarget", callback);
  }

  /**
   * Listen for target created
   */
  onTargetCreated(callback: (params: { targetInfo: TargetInfo }) => void): void {
    const client = this.getClient();
    (client as any).Target.on("targetCreated", callback);
  }

  /**
   * Listen for target destroyed
   */
  onTargetDestroyed(callback: (params: { targetId: string }) => void): void {
    const client = this.getClient();
    (client as any).Target.on("targetDestroyed", callback);
  }

  /**
   * Listen for target info changed
   */
  onTargetInfoChanged(callback: (params: { targetInfo: TargetInfo }) => void): void {
    const client = this.getClient();
    (client as any).Target.on("targetInfoChanged", callback);
  }

  /**
   * Listen for target crashed
   */
  onTargetCrashed(callback: (params: { targetId: string; status: string; errorCode: number }) => void): void {
    const client = this.getClient();
    (client as any).Target.on("targetCrashed", callback);
  }

  /**
   * Listen for received message from target
   */
  onReceivedMessageFromTarget(callback: (params: { sessionId: string; message: string; targetId?: string }) => void): void {
    const client = this.getClient();
    (client as any).Target.on("receivedMessageFromTarget", callback);
  }
}
