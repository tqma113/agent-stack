import CDP from "chrome-remote-interface";

export interface DOMNode {
  nodeType: number;
  nodeName: string;
  nodeValue: string;
  textValue?: string;
  inputValue?: string;
  inputChecked?: boolean;
  optionSelected?: boolean;
  backendNodeId: number;
  childNodeIndexes?: number[];
  attributes?: Array<{ name: string; value: string }>;
  pseudoElementIndexes?: number[];
  layoutNodeIndex?: number;
  documentURL?: string;
  baseURL?: string;
  contentLanguage?: string;
  documentEncoding?: string;
  publicId?: string;
  systemId?: string;
  frameId?: string;
  contentDocumentIndex?: number;
  pseudoType?: string;
  shadowRootType?: string;
  isClickable?: boolean;
  eventListeners?: any[];
  currentSourceURL?: string;
  originURL?: string;
  scrollOffsetX?: number;
  scrollOffsetY?: number;
}

export interface LayoutTreeNode {
  domNodeIndex: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  layoutText?: string;
  inlineTextNodes?: Array<{ boundingBox: any; startCharacterIndex: number; numCharacters: number }>;
  styleIndex?: number;
  paintOrder?: number;
  isStackingContext?: boolean;
}

export interface ComputedStyle {
  properties: Array<{ name: string; value: string }>;
}

export interface DocumentSnapshot {
  documentURL: number;
  title: number;
  baseURL: number;
  contentLanguage: number;
  encodingName: number;
  publicId: number;
  systemId: number;
  frameId: number;
  nodes: any;
  layout: any;
  textBoxes: any;
  scrollOffsetX?: number;
  scrollOffsetY?: number;
  contentWidth?: number;
  contentHeight?: number;
}

export class DOMSnapshotDomain {
  constructor(private getClient: () => CDP.Client) {}

  /**
   * Enable DOM snapshot domain
   */
  async enable(): Promise<void> {
    const client = this.getClient();
    await (client as any).DOMSnapshot.enable();
  }

  /**
   * Disable DOM snapshot domain
   */
  async disable(): Promise<void> {
    const client = this.getClient();
    await (client as any).DOMSnapshot.disable();
  }

  /**
   * Get snapshot (deprecated, use captureSnapshot)
   */
  async getSnapshot(options: {
    computedStyleWhitelist: string[];
    includeEventListeners?: boolean;
    includePaintOrder?: boolean;
    includeUserAgentShadowTree?: boolean;
  }): Promise<{ domNodes: DOMNode[]; layoutTreeNodes: LayoutTreeNode[]; computedStyles: ComputedStyle[] }> {
    const client = this.getClient();
    return (client as any).DOMSnapshot.getSnapshot(options);
  }

  /**
   * Capture snapshot
   */
  async captureSnapshot(options: {
    computedStyles: string[];
    includePaintOrder?: boolean;
    includeDOMRects?: boolean;
    includeBlendedBackgroundColors?: boolean;
    includeTextColorOpacities?: boolean;
  }): Promise<{ documents: DocumentSnapshot[]; strings: string[] }> {
    const client = this.getClient();
    return (client as any).DOMSnapshot.captureSnapshot(options);
  }
}
