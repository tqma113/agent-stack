import CDP from "chrome-remote-interface";

export interface BaseAudioContext {
  contextId: string;
  contextType: "realtime" | "offline";
  contextState: "suspended" | "running" | "closed";
  realtimeData?: ContextRealtimeData;
  callbackBufferSize: number;
  maxOutputChannelCount: number;
  sampleRate: number;
}

export interface ContextRealtimeData {
  currentTime: number;
  renderCapacity: number;
  callbackIntervalMean: number;
  callbackIntervalVariance: number;
}

export interface AudioListener {
  listenerId: string;
  contextId: string;
}

export interface AudioNode {
  nodeId: string;
  contextId: string;
  nodeType: string;
  numberOfInputs: number;
  numberOfOutputs: number;
  channelCount: number;
  channelCountMode: "clamped-max" | "explicit" | "max";
  channelInterpretation: "discrete" | "speakers";
}

export interface AudioParam {
  paramId: string;
  nodeId: string;
  contextId: string;
  paramType: string;
  rate: "a-rate" | "k-rate";
  defaultValue: number;
  minValue: number;
  maxValue: number;
}

export class WebAudioDomain {
  constructor(private getClient: () => CDP.Client) {}

  /**
   * Enable WebAudio domain
   */
  async enable(): Promise<void> {
    const client = this.getClient();
    await (client as any).WebAudio.enable();
  }

  /**
   * Disable WebAudio domain
   */
  async disable(): Promise<void> {
    const client = this.getClient();
    await (client as any).WebAudio.disable();
  }

  /**
   * Get realtime data
   */
  async getRealtimeData(contextId: string): Promise<{ realtimeData: ContextRealtimeData }> {
    const client = this.getClient();
    return (client as any).WebAudio.getRealtimeData({ contextId });
  }

  /**
   * Listen for context created
   */
  onContextCreated(callback: (params: { context: BaseAudioContext }) => void): void {
    const client = this.getClient();
    (client as any).WebAudio.on("contextCreated", callback);
  }

  /**
   * Listen for context will be destroyed
   */
  onContextWillBeDestroyed(callback: (params: { contextId: string }) => void): void {
    const client = this.getClient();
    (client as any).WebAudio.on("contextWillBeDestroyed", callback);
  }

  /**
   * Listen for context changed
   */
  onContextChanged(callback: (params: { context: BaseAudioContext }) => void): void {
    const client = this.getClient();
    (client as any).WebAudio.on("contextChanged", callback);
  }

  /**
   * Listen for audio listener created
   */
  onAudioListenerCreated(callback: (params: { listener: AudioListener }) => void): void {
    const client = this.getClient();
    (client as any).WebAudio.on("audioListenerCreated", callback);
  }

  /**
   * Listen for audio listener will be destroyed
   */
  onAudioListenerWillBeDestroyed(callback: (params: { contextId: string; listenerId: string }) => void): void {
    const client = this.getClient();
    (client as any).WebAudio.on("audioListenerWillBeDestroyed", callback);
  }

  /**
   * Listen for audio node created
   */
  onAudioNodeCreated(callback: (params: { node: AudioNode }) => void): void {
    const client = this.getClient();
    (client as any).WebAudio.on("audioNodeCreated", callback);
  }

  /**
   * Listen for audio node will be destroyed
   */
  onAudioNodeWillBeDestroyed(callback: (params: { contextId: string; nodeId: string }) => void): void {
    const client = this.getClient();
    (client as any).WebAudio.on("audioNodeWillBeDestroyed", callback);
  }

  /**
   * Listen for audio param created
   */
  onAudioParamCreated(callback: (params: { param: AudioParam }) => void): void {
    const client = this.getClient();
    (client as any).WebAudio.on("audioParamCreated", callback);
  }

  /**
   * Listen for audio param will be destroyed
   */
  onAudioParamWillBeDestroyed(callback: (params: { contextId: string; nodeId: string; paramId: string }) => void): void {
    const client = this.getClient();
    (client as any).WebAudio.on("audioParamWillBeDestroyed", callback);
  }

  /**
   * Listen for nodes connected
   */
  onNodesConnected(callback: (params: { contextId: string; sourceId: string; destinationId: string; sourceOutputIndex?: number; destinationInputIndex?: number }) => void): void {
    const client = this.getClient();
    (client as any).WebAudio.on("nodesConnected", callback);
  }

  /**
   * Listen for nodes disconnected
   */
  onNodesDisconnected(callback: (params: { contextId: string; sourceId: string; destinationId: string; sourceOutputIndex?: number; destinationInputIndex?: number }) => void): void {
    const client = this.getClient();
    (client as any).WebAudio.on("nodesDisconnected", callback);
  }

  /**
   * Listen for node param connected
   */
  onNodeParamConnected(callback: (params: { contextId: string; sourceId: string; destinationId: string; sourceOutputIndex?: number }) => void): void {
    const client = this.getClient();
    (client as any).WebAudio.on("nodeParamConnected", callback);
  }

  /**
   * Listen for node param disconnected
   */
  onNodeParamDisconnected(callback: (params: { contextId: string; sourceId: string; destinationId: string; sourceOutputIndex?: number }) => void): void {
    const client = this.getClient();
    (client as any).WebAudio.on("nodeParamDisconnected", callback);
  }
}
