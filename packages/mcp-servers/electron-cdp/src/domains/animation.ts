import CDP from "chrome-remote-interface";

export interface Animation {
  id: string;
  name: string;
  pausedState: boolean;
  playState: string;
  playbackRate: number;
  startTime: number;
  currentTime: number;
  type: "CSSTransition" | "CSSAnimation" | "WebAnimation";
  source?: AnimationEffect;
  cssId?: string;
}

export interface AnimationEffect {
  delay: number;
  endDelay: number;
  iterationStart: number;
  iterations: number;
  duration: number;
  direction: string;
  fill: string;
  backendNodeId?: number;
  keyframesRule?: KeyframesRule;
  easing: string;
}

export interface KeyframesRule {
  name?: string;
  keyframes: KeyframeStyle[];
}

export interface KeyframeStyle {
  offset: string;
  easing: string;
  style?: string;
}

export class AnimationDomain {
  private eventHandlers: Map<string, Function[]> = new Map();

  constructor(private getClient: () => CDP.Client) {}

  /**
   * Enable animation domain
   */
  async enable(): Promise<void> {
    const client = this.getClient();
    await (client as any).Animation.enable();
  }

  /**
   * Disable animation domain
   */
  async disable(): Promise<void> {
    const client = this.getClient();
    await (client as any).Animation.disable();
  }

  /**
   * Get current time for animation
   */
  async getCurrentTime(id: string): Promise<{ currentTime: number }> {
    const client = this.getClient();
    return (client as any).Animation.getCurrentTime({ id });
  }

  /**
   * Get playback rate
   */
  async getPlaybackRate(): Promise<{ playbackRate: number }> {
    const client = this.getClient();
    return (client as any).Animation.getPlaybackRate();
  }

  /**
   * Release animations
   */
  async releaseAnimations(animations: string[]): Promise<void> {
    const client = this.getClient();
    await (client as any).Animation.releaseAnimations({ animations });
  }

  /**
   * Resolve animation to its DOM node
   */
  async resolveAnimation(animationId: string): Promise<{ remoteObject: any }> {
    const client = this.getClient();
    return (client as any).Animation.resolveAnimation({ animationId });
  }

  /**
   * Seek a set of animations to a particular time
   */
  async seekAnimations(animations: string[], currentTime: number): Promise<void> {
    const client = this.getClient();
    await (client as any).Animation.seekAnimations({ animations, currentTime });
  }

  /**
   * Set paused state
   */
  async setPaused(animations: string[], paused: boolean): Promise<void> {
    const client = this.getClient();
    await (client as any).Animation.setPaused({ animations, paused });
  }

  /**
   * Set playback rate
   */
  async setPlaybackRate(playbackRate: number): Promise<void> {
    const client = this.getClient();
    await (client as any).Animation.setPlaybackRate({ playbackRate });
  }

  /**
   * Set timing of animation
   */
  async setTiming(animationId: string, duration: number, delay: number): Promise<void> {
    const client = this.getClient();
    await (client as any).Animation.setTiming({ animationId, duration, delay });
  }

  /**
   * Listen for animation created events
   */
  onAnimationCreated(callback: (animation: { id: string }) => void): void {
    const client = this.getClient();
    (client as any).Animation.on("animationCreated", callback);
  }

  /**
   * Listen for animation started events
   */
  onAnimationStarted(callback: (animation: Animation) => void): void {
    const client = this.getClient();
    (client as any).Animation.on("animationStarted", callback);
  }

  /**
   * Listen for animation canceled events
   */
  onAnimationCanceled(callback: (id: string) => void): void {
    const client = this.getClient();
    (client as any).Animation.on("animationCanceled", callback);
  }
}
