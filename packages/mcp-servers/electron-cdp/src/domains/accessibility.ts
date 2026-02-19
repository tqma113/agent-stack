import CDP from "chrome-remote-interface";

export interface AXNode {
  nodeId: string;
  ignored: boolean;
  role?: { type: string; value?: string };
  name?: { type: string; value?: string };
  description?: { type: string; value?: string };
  value?: { type: string; value?: string };
  properties?: Array<{ name: string; value: any }>;
  childIds?: string[];
  backendDOMNodeId?: number;
}

export class AccessibilityDomain {
  constructor(private getClient: () => CDP.Client) {}

  /**
   * Enable accessibility domain
   */
  async enable(): Promise<void> {
    const client = this.getClient();
    await (client as any).Accessibility.enable();
  }

  /**
   * Disable accessibility domain
   */
  async disable(): Promise<void> {
    const client = this.getClient();
    await (client as any).Accessibility.disable();
  }

  /**
   * Get the full accessibility tree
   */
  async getFullAXTree(options: {
    depth?: number;
    frameId?: string;
  } = {}): Promise<{ nodes: AXNode[] }> {
    const client = this.getClient();
    return (client as any).Accessibility.getFullAXTree(options);
  }

  /**
   * Get partial accessibility tree
   */
  async getPartialAXTree(options: {
    nodeId?: number;
    backendNodeId?: number;
    objectId?: string;
    fetchRelatives?: boolean;
  } = {}): Promise<{ nodes: AXNode[] }> {
    const client = this.getClient();
    return (client as any).Accessibility.getPartialAXTree(options);
  }

  /**
   * Get the root AX node
   */
  async getRootAXNode(options: {
    frameId?: string;
  } = {}): Promise<{ node: AXNode }> {
    const client = this.getClient();
    return (client as any).Accessibility.getRootAXNode(options);
  }

  /**
   * Get AX node and ancestors
   */
  async getAXNodeAndAncestors(options: {
    nodeId?: number;
    backendNodeId?: number;
    objectId?: string;
  } = {}): Promise<{ nodes: AXNode[] }> {
    const client = this.getClient();
    return (client as any).Accessibility.getAXNodeAndAncestors(options);
  }

  /**
   * Get child AX nodes
   */
  async getChildAXNodes(options: {
    id: string;
    frameId?: string;
  }): Promise<{ nodes: AXNode[] }> {
    const client = this.getClient();
    return (client as any).Accessibility.getChildAXNodes(options);
  }

  /**
   * Query accessibility nodes by accessible name and role
   */
  async queryAXTree(options: {
    nodeId?: number;
    backendNodeId?: number;
    objectId?: string;
    accessibleName?: string;
    role?: string;
  } = {}): Promise<{ nodes: AXNode[] }> {
    const client = this.getClient();
    return (client as any).Accessibility.queryAXTree(options);
  }
}
