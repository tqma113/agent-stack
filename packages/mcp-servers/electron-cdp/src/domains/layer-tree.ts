import CDP from "chrome-remote-interface";

export interface Layer {
  layerId: string;
  parentLayerId?: string;
  backendNodeId?: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  transform?: number[];
  anchorX?: number;
  anchorY?: number;
  anchorZ?: number;
  paintCount: number;
  drawsContent: boolean;
  invisible?: boolean;
  scrollRects?: ScrollRect[];
  stickyPositionConstraint?: StickyPositionConstraint;
}

export interface ScrollRect {
  rect: { x: number; y: number; width: number; height: number };
  type: "RepaintsOnScroll" | "TouchEventHandler" | "WheelEventHandler";
}

export interface StickyPositionConstraint {
  stickyBoxRect: { x: number; y: number; width: number; height: number };
  containingBlockRect: { x: number; y: number; width: number; height: number };
  nearestLayerShiftingStickyBox?: string;
  nearestLayerShiftingContainingBlock?: string;
}

export interface PictureTile {
  x: number;
  y: number;
  picture: string;
}

export class LayerTreeDomain {
  constructor(private getClient: () => CDP.Client) {}

  /**
   * Enable layer tree domain
   */
  async enable(): Promise<void> {
    const client = this.getClient();
    await (client as any).LayerTree.enable();
  }

  /**
   * Disable layer tree domain
   */
  async disable(): Promise<void> {
    const client = this.getClient();
    await (client as any).LayerTree.disable();
  }

  /**
   * Returns the snapshot identifier
   */
  async makeSnapshot(layerId: string): Promise<{ snapshotId: string }> {
    const client = this.getClient();
    return (client as any).LayerTree.makeSnapshot({ layerId });
  }

  /**
   * Returns the layer snapshot identifier
   */
  async loadSnapshot(tiles: PictureTile[]): Promise<{ snapshotId: string }> {
    const client = this.getClient();
    return (client as any).LayerTree.loadSnapshot({ tiles });
  }

  /**
   * Releases layer snapshot captured by the back-end
   */
  async releaseSnapshot(snapshotId: string): Promise<void> {
    const client = this.getClient();
    await (client as any).LayerTree.releaseSnapshot({ snapshotId });
  }

  /**
   * Returns array of objects describing supported compositing reasons
   */
  async compositingReasons(layerId: string): Promise<{ compositingReasons: string[]; compositingReasonIds: string[] }> {
    const client = this.getClient();
    return (client as any).LayerTree.compositingReasons({ layerId });
  }

  /**
   * Replays the layer snapshot and returns the resulting bitmap
   */
  async replaySnapshot(options: {
    snapshotId: string;
    fromStep?: number;
    toStep?: number;
    scale?: number;
  }): Promise<{ dataURL: string }> {
    const client = this.getClient();
    return (client as any).LayerTree.replaySnapshot(options);
  }

  /**
   * Replays the layer snapshot and returns canvas log
   */
  async profileSnapshot(options: {
    snapshotId: string;
    minRepeatCount?: number;
    minDuration?: number;
    clipRect?: { x: number; y: number; width: number; height: number };
  }): Promise<{ timings: number[][] }> {
    const client = this.getClient();
    return (client as any).LayerTree.profileSnapshot(options);
  }

  /**
   * Returns the paint order snapshot identifier
   */
  async snapshotCommandLog(snapshotId: string): Promise<{ commandLog: any[] }> {
    const client = this.getClient();
    return (client as any).LayerTree.snapshotCommandLog({ snapshotId });
  }

  /**
   * Listen for layer painted
   */
  onLayerPainted(callback: (params: { layerId: string; clip: { x: number; y: number; width: number; height: number } }) => void): void {
    const client = this.getClient();
    (client as any).LayerTree.on("layerPainted", callback);
  }

  /**
   * Listen for layer tree changed
   */
  onLayerTreeDidChange(callback: (params: { layers?: Layer[] }) => void): void {
    const client = this.getClient();
    (client as any).LayerTree.on("layerTreeDidChange", callback);
  }
}
