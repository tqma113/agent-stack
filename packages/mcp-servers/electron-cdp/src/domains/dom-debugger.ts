import CDP from "chrome-remote-interface";

export type DOMBreakpointType = "subtree-modified" | "attribute-modified" | "node-removed";

export interface EventListener {
  type: string;
  useCapture: boolean;
  passive: boolean;
  once: boolean;
  scriptId: string;
  lineNumber: number;
  columnNumber: number;
  handler?: any;
  originalHandler?: any;
  backendNodeId?: number;
}

export class DOMDebuggerDomain {
  constructor(private getClient: () => CDP.Client) {}

  /**
   * Set DOM breakpoint
   */
  async setDOMBreakpoint(nodeId: number, type: DOMBreakpointType): Promise<void> {
    const client = this.getClient();
    await (client as any).DOMDebugger.setDOMBreakpoint({ nodeId, type });
  }

  /**
   * Remove DOM breakpoint
   */
  async removeDOMBreakpoint(nodeId: number, type: DOMBreakpointType): Promise<void> {
    const client = this.getClient();
    await (client as any).DOMDebugger.removeDOMBreakpoint({ nodeId, type });
  }

  /**
   * Set event listener breakpoint
   */
  async setEventListenerBreakpoint(eventName: string, targetName?: string): Promise<void> {
    const client = this.getClient();
    await (client as any).DOMDebugger.setEventListenerBreakpoint({ eventName, targetName });
  }

  /**
   * Remove event listener breakpoint
   */
  async removeEventListenerBreakpoint(eventName: string, targetName?: string): Promise<void> {
    const client = this.getClient();
    await (client as any).DOMDebugger.removeEventListenerBreakpoint({ eventName, targetName });
  }

  /**
   * Set XHR breakpoint
   */
  async setXHRBreakpoint(url: string): Promise<void> {
    const client = this.getClient();
    await (client as any).DOMDebugger.setXHRBreakpoint({ url });
  }

  /**
   * Remove XHR breakpoint
   */
  async removeXHRBreakpoint(url: string): Promise<void> {
    const client = this.getClient();
    await (client as any).DOMDebugger.removeXHRBreakpoint({ url });
  }

  /**
   * Get event listeners
   */
  async getEventListeners(options: {
    objectId: string;
    depth?: number;
    pierce?: boolean;
  }): Promise<{ listeners: EventListener[] }> {
    const client = this.getClient();
    return (client as any).DOMDebugger.getEventListeners(options);
  }

  /**
   * Set instrumentation breakpoint
   */
  async setInstrumentationBreakpoint(eventName: string): Promise<void> {
    const client = this.getClient();
    await (client as any).DOMDebugger.setInstrumentationBreakpoint({ eventName });
  }

  /**
   * Remove instrumentation breakpoint
   */
  async removeInstrumentationBreakpoint(eventName: string): Promise<void> {
    const client = this.getClient();
    await (client as any).DOMDebugger.removeInstrumentationBreakpoint({ eventName });
  }
}
