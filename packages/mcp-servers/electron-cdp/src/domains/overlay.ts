import CDP from "chrome-remote-interface";

export interface HighlightConfig {
  showInfo?: boolean;
  showStyles?: boolean;
  showRulers?: boolean;
  showAccessibilityInfo?: boolean;
  showExtensionLines?: boolean;
  contentColor?: RGBA;
  paddingColor?: RGBA;
  borderColor?: RGBA;
  marginColor?: RGBA;
  eventTargetColor?: RGBA;
  shapeColor?: RGBA;
  shapeMarginColor?: RGBA;
  cssGridColor?: RGBA;
  colorFormat?: "rgb" | "hsl" | "hwb" | "hex";
  gridHighlightConfig?: GridHighlightConfig;
  flexContainerHighlightConfig?: FlexContainerHighlightConfig;
  flexItemHighlightConfig?: FlexItemHighlightConfig;
  contrastAlgorithm?: "aa" | "aaa" | "apca";
  containerQueryContainerHighlightConfig?: ContainerQueryContainerHighlightConfig;
}

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface GridHighlightConfig {
  showGridExtensionLines?: boolean;
  showPositiveLineNumbers?: boolean;
  showNegativeLineNumbers?: boolean;
  showAreaNames?: boolean;
  showLineNames?: boolean;
  showTrackSizes?: boolean;
  gridBorderColor?: RGBA;
  cellBorderColor?: RGBA;
  rowLineColor?: RGBA;
  columnLineColor?: RGBA;
  gridBorderDash?: boolean;
  cellBorderDash?: boolean;
  rowLineDash?: boolean;
  columnLineDash?: boolean;
  rowGapColor?: RGBA;
  rowHatchColor?: RGBA;
  columnGapColor?: RGBA;
  columnHatchColor?: RGBA;
  areaBorderColor?: RGBA;
  gridBackgroundColor?: RGBA;
}

export interface FlexContainerHighlightConfig {
  containerBorder?: LineStyle;
  lineSeparator?: LineStyle;
  itemSeparator?: LineStyle;
  mainDistributedSpace?: BoxStyle;
  crossDistributedSpace?: BoxStyle;
  rowGapSpace?: BoxStyle;
  columnGapSpace?: BoxStyle;
  crossAlignment?: LineStyle;
}

export interface FlexItemHighlightConfig {
  baseSizeBox?: BoxStyle;
  baseSizeBorder?: LineStyle;
  flexibilityArrow?: LineStyle;
}

export interface ContainerQueryContainerHighlightConfig {
  containerBorder?: LineStyle;
  descendantBorder?: LineStyle;
}

export interface LineStyle {
  color?: RGBA;
  pattern?: "dashed" | "dotted";
}

export interface BoxStyle {
  fillColor?: RGBA;
  hatchColor?: RGBA;
}

export type InspectMode = "searchForNode" | "searchForUAShadowDOM" | "captureAreaScreenshot" | "showDistances" | "none";

export class OverlayDomain {
  constructor(private getClient: () => CDP.Client) {}

  /**
   * Enable overlay domain
   */
  async enable(): Promise<void> {
    const client = this.getClient();
    await (client as any).Overlay.enable();
  }

  /**
   * Disable overlay domain
   */
  async disable(): Promise<void> {
    const client = this.getClient();
    await (client as any).Overlay.disable();
  }

  /**
   * Highlight the given node
   */
  async highlightNode(options: {
    highlightConfig: HighlightConfig;
    nodeId?: number;
    backendNodeId?: number;
    objectId?: string;
    selector?: string;
  }): Promise<void> {
    const client = this.getClient();
    await (client as any).Overlay.highlightNode(options);
  }

  /**
   * Highlight given quad
   */
  async highlightQuad(quad: number[], color?: RGBA, outlineColor?: RGBA): Promise<void> {
    const client = this.getClient();
    await (client as any).Overlay.highlightQuad({ quad, color, outlineColor });
  }

  /**
   * Highlight given rect
   */
  async highlightRect(options: {
    x: number;
    y: number;
    width: number;
    height: number;
    color?: RGBA;
    outlineColor?: RGBA;
  }): Promise<void> {
    const client = this.getClient();
    await (client as any).Overlay.highlightRect(options);
  }

  /**
   * Highlight source order
   */
  async highlightSourceOrder(options: {
    sourceOrderConfig: { parentOutlineColor: RGBA; childOutlineColor: RGBA };
    nodeId?: number;
    backendNodeId?: number;
    objectId?: string;
  }): Promise<void> {
    const client = this.getClient();
    await (client as any).Overlay.highlightSourceOrder(options);
  }

  /**
   * Hide highlight
   */
  async hideHighlight(): Promise<void> {
    const client = this.getClient();
    await (client as any).Overlay.hideHighlight();
  }

  /**
   * Get highlight object for test
   */
  async getHighlightObjectForTest(options: {
    nodeId: number;
    includeDistance?: boolean;
    includeStyle?: boolean;
    colorFormat?: "rgb" | "hsl" | "hwb" | "hex";
    showAccessibilityInfo?: boolean;
  }): Promise<{ highlight: any }> {
    const client = this.getClient();
    return (client as any).Overlay.getHighlightObjectForTest(options);
  }

  /**
   * Get grid highlight objects for test
   */
  async getGridHighlightObjectsForTest(nodeIds: number[]): Promise<{ highlights: any }> {
    const client = this.getClient();
    return (client as any).Overlay.getGridHighlightObjectsForTest({ nodeIds });
  }

  /**
   * Get source order highlight object for test
   */
  async getSourceOrderHighlightObjectForTest(nodeId: number): Promise<{ highlight: any }> {
    const client = this.getClient();
    return (client as any).Overlay.getSourceOrderHighlightObjectForTest({ nodeId });
  }

  /**
   * Set inspect mode
   */
  async setInspectMode(mode: InspectMode, highlightConfig?: HighlightConfig): Promise<void> {
    const client = this.getClient();
    await (client as any).Overlay.setInspectMode({ mode, highlightConfig });
  }

  /**
   * Set paused in debugger message
   */
  async setPausedInDebuggerMessage(message?: string): Promise<void> {
    const client = this.getClient();
    await (client as any).Overlay.setPausedInDebuggerMessage({ message });
  }

  /**
   * Set show ad highlights
   */
  async setShowAdHighlights(show: boolean): Promise<void> {
    const client = this.getClient();
    await (client as any).Overlay.setShowAdHighlights({ show });
  }

  /**
   * Set show debug borders
   */
  async setShowDebugBorders(show: boolean): Promise<void> {
    const client = this.getClient();
    await (client as any).Overlay.setShowDebugBorders({ show });
  }

  /**
   * Set show FPS counter
   */
  async setShowFPSCounter(show: boolean): Promise<void> {
    const client = this.getClient();
    await (client as any).Overlay.setShowFPSCounter({ show });
  }

  /**
   * Set show grid overlays
   */
  async setShowGridOverlays(gridNodeHighlightConfigs: Array<{ nodeId: number; gridHighlightConfig: GridHighlightConfig }>): Promise<void> {
    const client = this.getClient();
    await (client as any).Overlay.setShowGridOverlays({ gridNodeHighlightConfigs });
  }

  /**
   * Set show flex overlays
   */
  async setShowFlexOverlays(flexNodeHighlightConfigs: Array<{ nodeId: number; flexContainerHighlightConfig: FlexContainerHighlightConfig }>): Promise<void> {
    const client = this.getClient();
    await (client as any).Overlay.setShowFlexOverlays({ flexNodeHighlightConfigs });
  }

  /**
   * Set show scroll snap overlays
   */
  async setShowScrollSnapOverlays(scrollSnapHighlightConfigs: Array<{ nodeId: number }>): Promise<void> {
    const client = this.getClient();
    await (client as any).Overlay.setShowScrollSnapOverlays({ scrollSnapHighlightConfigs });
  }

  /**
   * Set show container query overlays
   */
  async setShowContainerQueryOverlays(containerQueryHighlightConfigs: Array<{ nodeId: number; containerQueryContainerHighlightConfig: ContainerQueryContainerHighlightConfig }>): Promise<void> {
    const client = this.getClient();
    await (client as any).Overlay.setShowContainerQueryOverlays({ containerQueryHighlightConfigs });
  }

  /**
   * Set show paint rects
   */
  async setShowPaintRects(result: boolean): Promise<void> {
    const client = this.getClient();
    await (client as any).Overlay.setShowPaintRects({ result });
  }

  /**
   * Set show layout shift regions
   */
  async setShowLayoutShiftRegions(result: boolean): Promise<void> {
    const client = this.getClient();
    await (client as any).Overlay.setShowLayoutShiftRegions({ result });
  }

  /**
   * Set show scroll bottleneck rects
   */
  async setShowScrollBottleneckRects(show: boolean): Promise<void> {
    const client = this.getClient();
    await (client as any).Overlay.setShowScrollBottleneckRects({ show });
  }

  /**
   * Set show hit test borders
   */
  async setShowHitTestBorders(show: boolean): Promise<void> {
    const client = this.getClient();
    await (client as any).Overlay.setShowHitTestBorders({ show });
  }

  /**
   * Set show web vitals
   */
  async setShowWebVitals(show: boolean): Promise<void> {
    const client = this.getClient();
    await (client as any).Overlay.setShowWebVitals({ show });
  }

  /**
   * Set show viewport size on resize
   */
  async setShowViewportSizeOnResize(show: boolean): Promise<void> {
    const client = this.getClient();
    await (client as any).Overlay.setShowViewportSizeOnResize({ show });
  }

  /**
   * Set show hinge
   */
  async setShowHinge(hingeConfig?: { rect: { x: number; y: number; width: number; height: number }; contentColor?: RGBA; outlineColor?: RGBA }): Promise<void> {
    const client = this.getClient();
    await (client as any).Overlay.setShowHinge({ hingeConfig });
  }

  /**
   * Set show isolated elements
   */
  async setShowIsolatedElements(isolatedElementHighlightConfigs: Array<{ nodeId: number; isolationModeHighlightConfig: any }>): Promise<void> {
    const client = this.getClient();
    await (client as any).Overlay.setShowIsolatedElements({ isolatedElementHighlightConfigs });
  }

  /**
   * Listen for inspect node requested
   */
  onInspectNodeRequested(callback: (params: { backendNodeId: number }) => void): void {
    const client = this.getClient();
    (client as any).Overlay.on("inspectNodeRequested", callback);
  }

  /**
   * Listen for node highlighted
   */
  onNodeHighlightRequested(callback: (params: { nodeId: number }) => void): void {
    const client = this.getClient();
    (client as any).Overlay.on("nodeHighlightRequested", callback);
  }

  /**
   * Listen for screenshot requested
   */
  onScreenshotRequested(callback: (params: { viewport: { x: number; y: number; width: number; height: number; scale: number } }) => void): void {
    const client = this.getClient();
    (client as any).Overlay.on("screenshotRequested", callback);
  }

  /**
   * Listen for inspect mode canceled
   */
  onInspectModeCanceled(callback: () => void): void {
    const client = this.getClient();
    (client as any).Overlay.on("inspectModeCanceled", callback);
  }
}
