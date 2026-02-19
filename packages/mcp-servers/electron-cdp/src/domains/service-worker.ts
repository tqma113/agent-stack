import CDP from "chrome-remote-interface";

export interface ServiceWorkerVersion {
  versionId: string;
  registrationId: string;
  scriptURL: string;
  runningStatus: "stopped" | "starting" | "running" | "stopping";
  status: "new" | "installing" | "installed" | "activating" | "activated" | "redundant";
  scriptLastModified?: number;
  scriptResponseTime?: number;
  controlledClients?: string[];
  targetId?: string;
}

export interface ServiceWorkerRegistration {
  registrationId: string;
  scopeURL: string;
  isDeleted: boolean;
}

export interface ServiceWorkerErrorMessage {
  errorMessage: string;
  registrationId: string;
  versionId: string;
  sourceURL: string;
  lineNumber: number;
  columnNumber: number;
}

export class ServiceWorkerDomain {
  constructor(private getClient: () => CDP.Client) {}

  /**
   * Enable service worker domain
   */
  async enable(): Promise<void> {
    const client = this.getClient();
    await (client as any).ServiceWorker.enable();
  }

  /**
   * Disable service worker domain
   */
  async disable(): Promise<void> {
    const client = this.getClient();
    await (client as any).ServiceWorker.disable();
  }

  /**
   * Unregister service worker
   */
  async unregister(scopeURL: string): Promise<void> {
    const client = this.getClient();
    await (client as any).ServiceWorker.unregister({ scopeURL });
  }

  /**
   * Update service worker registration
   */
  async updateRegistration(scopeURL: string): Promise<void> {
    const client = this.getClient();
    await (client as any).ServiceWorker.updateRegistration({ scopeURL });
  }

  /**
   * Start service worker
   */
  async startWorker(scopeURL: string): Promise<void> {
    const client = this.getClient();
    await (client as any).ServiceWorker.startWorker({ scopeURL });
  }

  /**
   * Skip waiting
   */
  async skipWaiting(scopeURL: string): Promise<void> {
    const client = this.getClient();
    await (client as any).ServiceWorker.skipWaiting({ scopeURL });
  }

  /**
   * Stop service worker
   */
  async stopWorker(versionId: string): Promise<void> {
    const client = this.getClient();
    await (client as any).ServiceWorker.stopWorker({ versionId });
  }

  /**
   * Stop all workers
   */
  async stopAllWorkers(): Promise<void> {
    const client = this.getClient();
    await (client as any).ServiceWorker.stopAllWorkers();
  }

  /**
   * Inspect service worker
   */
  async inspectWorker(versionId: string): Promise<void> {
    const client = this.getClient();
    await (client as any).ServiceWorker.inspectWorker({ versionId });
  }

  /**
   * Set force update on page load
   */
  async setForceUpdateOnPageLoad(forceUpdateOnPageLoad: boolean): Promise<void> {
    const client = this.getClient();
    await (client as any).ServiceWorker.setForceUpdateOnPageLoad({ forceUpdateOnPageLoad });
  }

  /**
   * Deliver push message
   */
  async deliverPushMessage(origin: string, registrationId: string, data: string): Promise<void> {
    const client = this.getClient();
    await (client as any).ServiceWorker.deliverPushMessage({ origin, registrationId, data });
  }

  /**
   * Dispatch sync event
   */
  async dispatchSyncEvent(origin: string, registrationId: string, tag: string, lastChance: boolean): Promise<void> {
    const client = this.getClient();
    await (client as any).ServiceWorker.dispatchSyncEvent({ origin, registrationId, tag, lastChance });
  }

  /**
   * Dispatch periodic sync event
   */
  async dispatchPeriodicSyncEvent(origin: string, registrationId: string, tag: string): Promise<void> {
    const client = this.getClient();
    await (client as any).ServiceWorker.dispatchPeriodicSyncEvent({ origin, registrationId, tag });
  }

  /**
   * Listen for worker registration updated
   */
  onWorkerRegistrationUpdated(callback: (params: { registrations: ServiceWorkerRegistration[] }) => void): void {
    const client = this.getClient();
    (client as any).ServiceWorker.on("workerRegistrationUpdated", callback);
  }

  /**
   * Listen for worker version updated
   */
  onWorkerVersionUpdated(callback: (params: { versions: ServiceWorkerVersion[] }) => void): void {
    const client = this.getClient();
    (client as any).ServiceWorker.on("workerVersionUpdated", callback);
  }

  /**
   * Listen for worker error reported
   */
  onWorkerErrorReported(callback: (params: { errorMessage: ServiceWorkerErrorMessage }) => void): void {
    const client = this.getClient();
    (client as any).ServiceWorker.on("workerErrorReported", callback);
  }
}
