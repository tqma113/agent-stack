import CDP from "chrome-remote-interface";

export interface CSSStyleSheetHeader {
  styleSheetId: string;
  frameId: string;
  sourceURL: string;
  origin: "injected" | "user-agent" | "inspector" | "regular";
  title: string;
  ownerNode?: number;
  disabled: boolean;
  hasSourceURL?: boolean;
  isInline: boolean;
  isMutable: boolean;
  isConstructed: boolean;
  startLine: number;
  startColumn: number;
  length: number;
  endLine: number;
  endColumn: number;
}

export interface CSSRule {
  styleSheetId?: string;
  selectorList: {
    selectors: Array<{ text: string; range?: any }>;
    text: string;
  };
  origin: "injected" | "user-agent" | "inspector" | "regular";
  style: CSSStyle;
  media?: any[];
  containerQueries?: any[];
  supports?: any[];
  layers?: any[];
  scopes?: any[];
}

export interface CSSStyle {
  styleSheetId?: string;
  cssProperties: CSSProperty[];
  shorthandEntries: Array<{ name: string; value: string; important?: boolean }>;
  cssText?: string;
  range?: any;
}

export interface CSSProperty {
  name: string;
  value: string;
  important?: boolean;
  implicit?: boolean;
  text?: string;
  parsedOk?: boolean;
  disabled?: boolean;
  range?: any;
  longhandProperties?: CSSProperty[];
}

export interface CSSComputedStyleProperty {
  name: string;
  value: string;
}

export class CSSDomain {
  constructor(private getClient: () => CDP.Client) {}

  /**
   * Enable CSS domain
   */
  async enable(): Promise<void> {
    const client = this.getClient();
    await (client as any).CSS.enable();
  }

  /**
   * Disable CSS domain
   */
  async disable(): Promise<void> {
    const client = this.getClient();
    await (client as any).CSS.disable();
  }

  /**
   * Get matched styles for node
   */
  async getMatchedStylesForNode(nodeId: number): Promise<{
    inlineStyle?: CSSStyle;
    attributesStyle?: CSSStyle;
    matchedCSSRules?: Array<{ rule: CSSRule; matchingSelectors: number[] }>;
    pseudoElements?: any[];
    inherited?: any[];
    inheritedPseudoElements?: any[];
    cssKeyframesRules?: any[];
    cssPositionFallbackRules?: any[];
    parentLayoutNodeId?: number;
  }> {
    const client = this.getClient();
    return (client as any).CSS.getMatchedStylesForNode({ nodeId });
  }

  /**
   * Get inline styles for node
   */
  async getInlineStylesForNode(nodeId: number): Promise<{ inlineStyle?: CSSStyle; attributesStyle?: CSSStyle }> {
    const client = this.getClient();
    return (client as any).CSS.getInlineStylesForNode({ nodeId });
  }

  /**
   * Get computed style for node
   */
  async getComputedStyleForNode(nodeId: number): Promise<{ computedStyle: CSSComputedStyleProperty[] }> {
    const client = this.getClient();
    return (client as any).CSS.getComputedStyleForNode({ nodeId });
  }

  /**
   * Get platform fonts for node
   */
  async getPlatformFontsForNode(nodeId: number): Promise<{ fonts: Array<{ familyName: string; isCustomFont: boolean; glyphCount: number }> }> {
    const client = this.getClient();
    return (client as any).CSS.getPlatformFontsForNode({ nodeId });
  }

  /**
   * Get stylesheet text
   */
  async getStyleSheetText(styleSheetId: string): Promise<{ text: string }> {
    const client = this.getClient();
    return (client as any).CSS.getStyleSheetText({ styleSheetId });
  }

  /**
   * Set stylesheet text
   */
  async setStyleSheetText(styleSheetId: string, text: string): Promise<{ sourceMapURL?: string }> {
    const client = this.getClient();
    return (client as any).CSS.setStyleSheetText({ styleSheetId, text });
  }

  /**
   * Set style texts
   */
  async setStyleTexts(edits: Array<{ styleSheetId: string; range: any; text: string }>): Promise<{ styles: CSSStyle[] }> {
    const client = this.getClient();
    return (client as any).CSS.setStyleTexts({ edits });
  }

  /**
   * Set rule selector
   */
  async setRuleSelector(options: { styleSheetId: string; range: any; selector: string }): Promise<{ selectorList: any }> {
    const client = this.getClient();
    return (client as any).CSS.setRuleSelector(options);
  }

  /**
   * Set media text
   */
  async setMediaText(options: { styleSheetId: string; range: any; text: string }): Promise<{ media: any }> {
    const client = this.getClient();
    return (client as any).CSS.setMediaText(options);
  }

  /**
   * Create stylesheet
   */
  async createStyleSheet(frameId: string): Promise<{ styleSheetId: string }> {
    const client = this.getClient();
    return (client as any).CSS.createStyleSheet({ frameId });
  }

  /**
   * Add rule
   */
  async addRule(options: { styleSheetId: string; ruleText: string; location: any }): Promise<{ rule: CSSRule }> {
    const client = this.getClient();
    return (client as any).CSS.addRule(options);
  }

  /**
   * Force pseudo state
   */
  async forcePseudoState(nodeId: number, forcedPseudoClasses: string[]): Promise<void> {
    const client = this.getClient();
    await (client as any).CSS.forcePseudoState({ nodeId, forcedPseudoClasses });
  }

  /**
   * Get media queries
   */
  async getMediaQueries(): Promise<{ medias: any[] }> {
    const client = this.getClient();
    return (client as any).CSS.getMediaQueries();
  }

  /**
   * Get background colors
   */
  async getBackgroundColors(nodeId: number): Promise<{ backgroundColors?: string[]; computedFontSize?: string; computedFontWeight?: string }> {
    const client = this.getClient();
    return (client as any).CSS.getBackgroundColors({ nodeId });
  }

  /**
   * Start rule usage tracking
   */
  async startRuleUsageTracking(): Promise<void> {
    const client = this.getClient();
    await (client as any).CSS.startRuleUsageTracking();
  }

  /**
   * Stop rule usage tracking
   */
  async stopRuleUsageTracking(): Promise<{ ruleUsage: Array<{ styleSheetId: string; startOffset: number; endOffset: number; used: boolean }> }> {
    const client = this.getClient();
    return (client as any).CSS.stopRuleUsageTracking();
  }

  /**
   * Take coverage delta
   */
  async takeCoverageDelta(): Promise<{ coverage: Array<{ styleSheetId: string; startOffset: number; endOffset: number; used: boolean }>; timestamp: number }> {
    const client = this.getClient();
    return (client as any).CSS.takeCoverageDelta();
  }

  /**
   * Set effective property value for node
   */
  async setEffectivePropertyValueForNode(options: { nodeId: number; propertyName: string; value: string }): Promise<void> {
    const client = this.getClient();
    await (client as any).CSS.setEffectivePropertyValueForNode(options);
  }

  /**
   * Listen for stylesheet added
   */
  onStyleSheetAdded(callback: (params: { header: CSSStyleSheetHeader }) => void): void {
    const client = this.getClient();
    (client as any).CSS.on("styleSheetAdded", callback);
  }

  /**
   * Listen for stylesheet removed
   */
  onStyleSheetRemoved(callback: (params: { styleSheetId: string }) => void): void {
    const client = this.getClient();
    (client as any).CSS.on("styleSheetRemoved", callback);
  }

  /**
   * Listen for stylesheet changed
   */
  onStyleSheetChanged(callback: (params: { styleSheetId: string }) => void): void {
    const client = this.getClient();
    (client as any).CSS.on("styleSheetChanged", callback);
  }

  /**
   * Listen for fonts updated
   */
  onFontsUpdated(callback: (params: { font?: any }) => void): void {
    const client = this.getClient();
    (client as any).CSS.on("fontsUpdated", callback);
  }

  /**
   * Listen for media query result changed
   */
  onMediaQueryResultChanged(callback: () => void): void {
    const client = this.getClient();
    (client as any).CSS.on("mediaQueryResultChanged", callback);
  }
}
