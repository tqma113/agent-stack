import CDP from "chrome-remote-interface";

export interface Location {
  scriptId: string;
  lineNumber: number;
  columnNumber?: number;
}

export interface BreakLocation extends Location {
  type?: "debuggerStatement" | "call" | "return";
}

export interface Scope {
  type: "global" | "local" | "with" | "closure" | "catch" | "block" | "script" | "eval" | "module" | "wasm-expression-stack";
  object: any;
  name?: string;
  startLocation?: Location;
  endLocation?: Location;
}

export interface CallFrame {
  callFrameId: string;
  functionName: string;
  functionLocation?: Location;
  location: Location;
  url: string;
  scopeChain: Scope[];
  this: any;
  returnValue?: any;
  canBeRestarted?: boolean;
}

export interface ScriptParsedEvent {
  scriptId: string;
  url: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  executionContextId: number;
  hash: string;
  isModule?: boolean;
  length?: number;
  sourceMapURL?: string;
}

export class DebuggerDomain {
  constructor(private getClient: () => CDP.Client) {}

  /**
   * Enable debugger
   */
  async enable(options: {
    maxScriptsCacheSize?: number;
  } = {}): Promise<{ debuggerId: string }> {
    const client = this.getClient();
    return (client as any).Debugger.enable(options);
  }

  /**
   * Disable debugger
   */
  async disable(): Promise<void> {
    const client = this.getClient();
    await (client as any).Debugger.disable();
  }

  /**
   * Set breakpoint by URL
   */
  async setBreakpointByUrl(options: {
    lineNumber: number;
    url?: string;
    urlRegex?: string;
    scriptHash?: string;
    columnNumber?: number;
    condition?: string;
  }): Promise<{ breakpointId: string; locations: Location[] }> {
    const client = this.getClient();
    return (client as any).Debugger.setBreakpointByUrl(options);
  }

  /**
   * Set breakpoint
   */
  async setBreakpoint(options: {
    location: Location;
    condition?: string;
  }): Promise<{ breakpointId: string; actualLocation: Location }> {
    const client = this.getClient();
    return (client as any).Debugger.setBreakpoint(options);
  }

  /**
   * Remove breakpoint
   */
  async removeBreakpoint(breakpointId: string): Promise<void> {
    const client = this.getClient();
    await (client as any).Debugger.removeBreakpoint({ breakpointId });
  }

  /**
   * Get possible breakpoint locations
   */
  async getPossibleBreakpoints(options: {
    start: Location;
    end?: Location;
    restrictToFunction?: boolean;
  }): Promise<{ locations: BreakLocation[] }> {
    const client = this.getClient();
    return (client as any).Debugger.getPossibleBreakpoints(options);
  }

  /**
   * Continue to location
   */
  async continueToLocation(options: {
    location: Location;
    targetCallFrames?: "any" | "current";
  }): Promise<void> {
    const client = this.getClient();
    await (client as any).Debugger.continueToLocation(options);
  }

  /**
   * Pause execution
   */
  async pause(): Promise<void> {
    const client = this.getClient();
    await (client as any).Debugger.pause();
  }

  /**
   * Resume execution
   */
  async resume(options: {
    terminateOnResume?: boolean;
  } = {}): Promise<void> {
    const client = this.getClient();
    await (client as any).Debugger.resume(options);
  }

  /**
   * Step over
   */
  async stepOver(options: {
    skipList?: Array<{ scriptId: string; start: Location; end: Location }>;
  } = {}): Promise<void> {
    const client = this.getClient();
    await (client as any).Debugger.stepOver(options);
  }

  /**
   * Step into
   */
  async stepInto(options: {
    breakOnAsyncCall?: boolean;
    skipList?: Array<{ scriptId: string; start: Location; end: Location }>;
  } = {}): Promise<void> {
    const client = this.getClient();
    await (client as any).Debugger.stepInto(options);
  }

  /**
   * Step out
   */
  async stepOut(): Promise<void> {
    const client = this.getClient();
    await (client as any).Debugger.stepOut();
  }

  /**
   * Evaluate on call frame
   */
  async evaluateOnCallFrame(options: {
    callFrameId: string;
    expression: string;
    objectGroup?: string;
    includeCommandLineAPI?: boolean;
    silent?: boolean;
    returnByValue?: boolean;
    generatePreview?: boolean;
    throwOnSideEffect?: boolean;
    timeout?: number;
  }): Promise<{ result: any; exceptionDetails?: any }> {
    const client = this.getClient();
    return (client as any).Debugger.evaluateOnCallFrame(options);
  }

  /**
   * Set variable value
   */
  async setVariableValue(options: {
    scopeNumber: number;
    variableName: string;
    newValue: any;
    callFrameId: string;
  }): Promise<void> {
    const client = this.getClient();
    await (client as any).Debugger.setVariableValue(options);
  }

  /**
   * Get script source
   */
  async getScriptSource(scriptId: string): Promise<{ scriptSource: string; bytecode?: string }> {
    const client = this.getClient();
    return (client as any).Debugger.getScriptSource({ scriptId });
  }

  /**
   * Set script source (live edit)
   */
  async setScriptSource(options: {
    scriptId: string;
    scriptSource: string;
    dryRun?: boolean;
    allowTopFrameEditing?: boolean;
  }): Promise<{ callFrames?: CallFrame[]; stackChanged?: boolean; asyncStackTrace?: any; asyncStackTraceId?: any; status: string; exceptionDetails?: any }> {
    const client = this.getClient();
    return (client as any).Debugger.setScriptSource(options);
  }

  /**
   * Restart frame
   */
  async restartFrame(options: {
    callFrameId: string;
    mode?: "StepInto";
  }): Promise<{ callFrames: CallFrame[]; asyncStackTrace?: any; asyncStackTraceId?: any }> {
    const client = this.getClient();
    return (client as any).Debugger.restartFrame(options);
  }

  /**
   * Get stack trace
   */
  async getStackTrace(stackTraceId: { debuggerId?: string; id: string }): Promise<{ stackTrace: any }> {
    const client = this.getClient();
    return (client as any).Debugger.getStackTrace({ stackTraceId });
  }

  /**
   * Search in content
   */
  async searchInContent(options: {
    scriptId: string;
    query: string;
    caseSensitive?: boolean;
    isRegex?: boolean;
  }): Promise<{ result: Array<{ lineNumber: number; lineContent: string }> }> {
    const client = this.getClient();
    return (client as any).Debugger.searchInContent(options);
  }

  /**
   * Set pause on exceptions
   */
  async setPauseOnExceptions(state: "none" | "uncaught" | "all"): Promise<void> {
    const client = this.getClient();
    await (client as any).Debugger.setPauseOnExceptions({ state });
  }

  /**
   * Set async call stack depth
   */
  async setAsyncCallStackDepth(maxDepth: number): Promise<void> {
    const client = this.getClient();
    await (client as any).Debugger.setAsyncCallStackDepth({ maxDepth });
  }

  /**
   * Set blackbox patterns
   */
  async setBlackboxPatterns(patterns: string[]): Promise<void> {
    const client = this.getClient();
    await (client as any).Debugger.setBlackboxPatterns({ patterns });
  }

  /**
   * Set blackboxed ranges
   */
  async setBlackboxedRanges(options: {
    scriptId: string;
    positions: Array<{ lineNumber: number; columnNumber: number }>;
  }): Promise<void> {
    const client = this.getClient();
    await (client as any).Debugger.setBlackboxedRanges(options);
  }

  /**
   * Listen for script parsed
   */
  onScriptParsed(callback: (params: ScriptParsedEvent) => void): void {
    const client = this.getClient();
    (client as any).Debugger.on("scriptParsed", callback);
  }

  /**
   * Listen for script failed to parse
   */
  onScriptFailedToParse(callback: (params: any) => void): void {
    const client = this.getClient();
    (client as any).Debugger.on("scriptFailedToParse", callback);
  }

  /**
   * Listen for paused
   */
  onPaused(callback: (params: { callFrames: CallFrame[]; reason: string; data?: any; hitBreakpoints?: string[]; asyncStackTrace?: any; asyncStackTraceId?: any; asyncCallStackTraceId?: any }) => void): void {
    const client = this.getClient();
    (client as any).Debugger.on("paused", callback);
  }

  /**
   * Listen for resumed
   */
  onResumed(callback: () => void): void {
    const client = this.getClient();
    (client as any).Debugger.on("resumed", callback);
  }

  /**
   * Listen for breakpoint resolved
   */
  onBreakpointResolved(callback: (params: { breakpointId: string; location: Location }) => void): void {
    const client = this.getClient();
    (client as any).Debugger.on("breakpointResolved", callback);
  }
}
