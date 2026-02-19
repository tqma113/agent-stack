import CDP from "chrome-remote-interface";
import {
  AccessibilityDomain,
  AnimationDomain,
  PerformanceDomain,
  TracingDomain,
  ProfilerDomain,
  HeapProfilerDomain,
  DebuggerDomain,
  ConsoleDomain,
  CSSDomain,
  DOMDebuggerDomain,
  DOMSnapshotDomain,
  StorageDomain,
  IndexedDBDomain,
  ServiceWorkerDomain,
  CacheStorageDomain,
  TargetDomain,
  OverlayDomain,
  LogDomain,
  MemoryDomain,
  MediaDomain,
  WebAudioDomain,
  SecurityDomain,
  LayerTreeDomain,
  IODomain,
  SystemInfoDomain,
  BrowserDomain,
  AuditsDomain,
  FetchDomain,
} from "./domains";

export interface ElectronTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

export interface ConnectionOptions {
  host?: string;
  port?: number;
  target?: string | ((targets: ElectronTarget[]) => ElectronTarget);
}

export class ElectronCDPManager {
  private client: CDP.Client | null = null;
  private host: string = "localhost";
  private port: number = 9222;
  private currentTarget: ElectronTarget | null = null;

  // Domain instances
  public readonly accessibility: AccessibilityDomain;
  public readonly animation: AnimationDomain;
  public readonly performance: PerformanceDomain;
  public readonly tracing: TracingDomain;
  public readonly profiler: ProfilerDomain;
  public readonly heapProfiler: HeapProfilerDomain;
  public readonly debugger: DebuggerDomain;
  public readonly console: ConsoleDomain;
  public readonly css: CSSDomain;
  public readonly domDebugger: DOMDebuggerDomain;
  public readonly domSnapshot: DOMSnapshotDomain;
  public readonly storage: StorageDomain;
  public readonly indexedDB: IndexedDBDomain;
  public readonly serviceWorker: ServiceWorkerDomain;
  public readonly cacheStorage: CacheStorageDomain;
  public readonly target: TargetDomain;
  public readonly overlay: OverlayDomain;
  public readonly log: LogDomain;
  public readonly memory: MemoryDomain;
  public readonly media: MediaDomain;
  public readonly webAudio: WebAudioDomain;
  public readonly security: SecurityDomain;
  public readonly layerTree: LayerTreeDomain;
  public readonly io: IODomain;
  public readonly systemInfo: SystemInfoDomain;
  public readonly browser: BrowserDomain;
  public readonly audits: AuditsDomain;
  public readonly fetch: FetchDomain;

  constructor() {
    const getClient = () => this.getClient();

    // Initialize domain instances
    this.accessibility = new AccessibilityDomain(getClient);
    this.animation = new AnimationDomain(getClient);
    this.performance = new PerformanceDomain(getClient);
    this.tracing = new TracingDomain(getClient);
    this.profiler = new ProfilerDomain(getClient);
    this.heapProfiler = new HeapProfilerDomain(getClient);
    this.debugger = new DebuggerDomain(getClient);
    this.console = new ConsoleDomain(getClient);
    this.css = new CSSDomain(getClient);
    this.domDebugger = new DOMDebuggerDomain(getClient);
    this.domSnapshot = new DOMSnapshotDomain(getClient);
    this.storage = new StorageDomain(getClient);
    this.indexedDB = new IndexedDBDomain(getClient);
    this.serviceWorker = new ServiceWorkerDomain(getClient);
    this.cacheStorage = new CacheStorageDomain(getClient);
    this.target = new TargetDomain(getClient);
    this.overlay = new OverlayDomain(getClient);
    this.log = new LogDomain(getClient);
    this.memory = new MemoryDomain(getClient);
    this.media = new MediaDomain(getClient);
    this.webAudio = new WebAudioDomain(getClient);
    this.security = new SecurityDomain(getClient);
    this.layerTree = new LayerTreeDomain(getClient);
    this.io = new IODomain(getClient);
    this.systemInfo = new SystemInfoDomain(getClient);
    this.browser = new BrowserDomain(getClient);
    this.audits = new AuditsDomain(getClient);
    this.fetch = new FetchDomain(getClient);
  }

  async connect(options: ConnectionOptions = {}): Promise<string> {
    if (this.client) {
      await this.disconnect();
    }

    this.host = options.host || this.host;
    this.port = options.port || this.port;

    try {
      const targets = await this.listTargets();

      let targetToConnect: ElectronTarget | undefined;

      if (options.target) {
        if (typeof options.target === "function") {
          targetToConnect = options.target(targets);
        } else {
          targetToConnect = targets.find(
            (t) => t.id === options.target || t.title.includes(options.target as string)
          );
        }
      } else {
        // Default: connect to first page target
        targetToConnect = targets.find((t) => t.type === "page") || targets[0];
      }

      if (!targetToConnect) {
        throw new Error("No suitable target found");
      }

      this.client = await CDP({
        host: this.host,
        port: this.port,
        target: targetToConnect.id,
      });

      this.currentTarget = targetToConnect;

      // Enable necessary domains
      await Promise.all([
        this.client.Page.enable(),
        this.client.Runtime.enable(),
        this.client.DOM.enable(),
        this.client.Network.enable(),
      ]);

      return `Connected to target: ${targetToConnect.title} (${targetToConnect.id})`;
    } catch (error) {
      throw new Error(
        `Failed to connect to Electron at ${this.host}:${this.port}: ${error}`
      );
    }
  }

  async disconnect(): Promise<string> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.currentTarget = null;
      return "Disconnected from Electron";
    }
    return "No active connection";
  }

  async listTargets(): Promise<ElectronTarget[]> {
    const targets = await CDP.List({ host: this.host, port: this.port });
    return targets.map((t: any) => ({
      id: t.id,
      type: t.type,
      title: t.title,
      url: t.url,
      webSocketDebuggerUrl: t.webSocketDebuggerUrl,
    }));
  }

  getClient(): CDP.Client {
    if (!this.client) {
      throw new Error("Not connected to Electron. Call connect() first.");
    }
    return this.client;
  }

  getCurrentTarget(): ElectronTarget | null {
    return this.currentTarget;
  }

  isConnected(): boolean {
    return this.client !== null;
  }

  // Page domain methods
  async navigate(url: string): Promise<any> {
    const client = this.getClient();
    return client.Page.navigate({ url });
  }

  async reload(ignoreCache: boolean = false): Promise<any> {
    const client = this.getClient();
    return client.Page.reload({ ignoreCache });
  }

  async goBack(): Promise<any> {
    const client = this.getClient();
    const history = await client.Page.getNavigationHistory();
    if (history.currentIndex > 0) {
      const entry = history.entries[history.currentIndex - 1];
      return client.Page.navigateToHistoryEntry({ entryId: entry.id });
    }
    throw new Error("Cannot go back - already at the first page");
  }

  async goForward(): Promise<any> {
    const client = this.getClient();
    const history = await client.Page.getNavigationHistory();
    if (history.currentIndex < history.entries.length - 1) {
      const entry = history.entries[history.currentIndex + 1];
      return client.Page.navigateToHistoryEntry({ entryId: entry.id });
    }
    throw new Error("Cannot go forward - already at the last page");
  }

  async captureScreenshot(format: "jpeg" | "png" | "webp" = "png", quality?: number): Promise<string> {
    const client = this.getClient();
    const result = await client.Page.captureScreenshot({
      format,
      quality,
    });
    return result.data;
  }

  // Runtime domain methods
  async evaluate(expression: string, returnByValue: boolean = true): Promise<any> {
    const client = this.getClient();
    const result = await client.Runtime.evaluate({
      expression,
      returnByValue,
      awaitPromise: true,
    });

    if (result.exceptionDetails) {
      throw new Error(
        `Evaluation failed: ${result.exceptionDetails.text || JSON.stringify(result.exceptionDetails)}`
      );
    }

    return result.result.value;
  }

  async callFunction(
    functionDeclaration: string,
    args: any[] = [],
    returnByValue: boolean = true
  ): Promise<any> {
    const client = this.getClient();

    const result = await client.Runtime.evaluate({
      expression: `(${functionDeclaration})(${args.map((a) => JSON.stringify(a)).join(", ")})`,
      returnByValue,
      awaitPromise: true,
    });

    if (result.exceptionDetails) {
      throw new Error(
        `Function call failed: ${result.exceptionDetails.text || JSON.stringify(result.exceptionDetails)}`
      );
    }

    return result.result.value;
  }

  // DOM domain methods
  async getDocument(): Promise<any> {
    const client = this.getClient();
    return client.DOM.getDocument({ depth: -1, pierce: true });
  }

  async querySelector(selector: string): Promise<number | null> {
    const client = this.getClient();
    const { root } = await client.DOM.getDocument();
    const result = await client.DOM.querySelector({
      nodeId: root.nodeId,
      selector,
    });
    return result.nodeId || null;
  }

  async querySelectorAll(selector: string): Promise<number[]> {
    const client = this.getClient();
    const { root } = await client.DOM.getDocument();
    const result = await client.DOM.querySelectorAll({
      nodeId: root.nodeId,
      selector,
    });
    return result.nodeIds;
  }

  async getOuterHTML(nodeId: number): Promise<string> {
    const client = this.getClient();
    const result = await client.DOM.getOuterHTML({ nodeId });
    return result.outerHTML;
  }

  async setAttributeValue(nodeId: number, name: string, value: string): Promise<void> {
    const client = this.getClient();
    await client.DOM.setAttributeValue({ nodeId, name, value });
  }

  // Input domain methods
  async click(x: number, y: number, button: "left" | "right" | "middle" = "left"): Promise<void> {
    const client = this.getClient();
    await client.Input.dispatchMouseEvent({
      type: "mousePressed",
      x,
      y,
      button,
      clickCount: 1,
    });
    await client.Input.dispatchMouseEvent({
      type: "mouseReleased",
      x,
      y,
      button,
      clickCount: 1,
    });
  }

  async clickElement(selector: string): Promise<void> {
    const client = this.getClient();

    // Get element bounding box using JavaScript
    const box = await this.evaluate(`
      (() => {
        const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2
        };
      })()
    `);

    if (!box) {
      throw new Error(`Element not found: ${selector}`);
    }

    await this.click(box.x, box.y);
  }

  async type(text: string): Promise<void> {
    const client = this.getClient();
    for (const char of text) {
      await client.Input.dispatchKeyEvent({
        type: "keyDown",
        text: char,
      });
      await client.Input.dispatchKeyEvent({
        type: "keyUp",
        text: char,
      });
    }
  }

  async typeInElement(selector: string, text: string): Promise<void> {
    await this.clickElement(selector);
    await this.type(text);
  }

  async pressKey(key: string, modifiers: number = 0): Promise<void> {
    const client = this.getClient();

    // Map common key names to key codes
    const keyMap: Record<string, { code: string; keyCode: number }> = {
      Enter: { code: "Enter", keyCode: 13 },
      Tab: { code: "Tab", keyCode: 9 },
      Escape: { code: "Escape", keyCode: 27 },
      Backspace: { code: "Backspace", keyCode: 8 },
      Delete: { code: "Delete", keyCode: 46 },
      ArrowUp: { code: "ArrowUp", keyCode: 38 },
      ArrowDown: { code: "ArrowDown", keyCode: 40 },
      ArrowLeft: { code: "ArrowLeft", keyCode: 37 },
      ArrowRight: { code: "ArrowRight", keyCode: 39 },
    };

    const keyInfo = keyMap[key] || { code: key, keyCode: key.charCodeAt(0) };

    await client.Input.dispatchKeyEvent({
      type: "keyDown",
      key,
      code: keyInfo.code,
      windowsVirtualKeyCode: keyInfo.keyCode,
      modifiers,
    });
    await client.Input.dispatchKeyEvent({
      type: "keyUp",
      key,
      code: keyInfo.code,
      windowsVirtualKeyCode: keyInfo.keyCode,
      modifiers,
    });
  }

  // Network domain methods
  async setRequestInterception(patterns: string[]): Promise<void> {
    const client = this.getClient();
    await client.Network.setRequestInterception({
      patterns: patterns.map((p) => ({ urlPattern: p })),
    });
  }

  async getCookies(urls?: string[]): Promise<any[]> {
    const client = this.getClient();
    const result = await client.Network.getCookies({ urls });
    return result.cookies;
  }

  async setCookie(
    name: string,
    value: string,
    options: {
      url?: string;
      domain?: string;
      path?: string;
      secure?: boolean;
      httpOnly?: boolean;
      sameSite?: "Strict" | "Lax" | "None";
      expires?: number;
    } = {}
  ): Promise<void> {
    const client = this.getClient();
    await client.Network.setCookie({
      name,
      value,
      ...options,
    });
  }

  async clearBrowserCookies(): Promise<void> {
    const client = this.getClient();
    await client.Network.clearBrowserCookies();
  }

  // Emulation domain methods
  async setDeviceMetrics(
    width: number,
    height: number,
    deviceScaleFactor: number = 1,
    mobile: boolean = false
  ): Promise<void> {
    const client = this.getClient();
    await client.Emulation.setDeviceMetricsOverride({
      width,
      height,
      deviceScaleFactor,
      mobile,
    });
  }

  async setUserAgent(userAgent: string): Promise<void> {
    const client = this.getClient();
    await client.Emulation.setUserAgentOverride({ userAgent });
  }

  // Console messages
  async enableConsoleMessages(callback: (message: any) => void): Promise<void> {
    const client = this.getClient();
    client.Runtime.on("consoleAPICalled", callback);
  }

  // Get page info
  async getPageInfo(): Promise<{
    url: string;
    title: string;
    loaderId: string;
  }> {
    const client = this.getClient();
    const frameTree = await client.Page.getFrameTree();
    const frame = frameTree.frameTree.frame;
    return {
      url: frame.url,
      title: frame.name || "",
      loaderId: frame.loaderId,
    };
  }

  // Get page content
  async getPageContent(): Promise<string> {
    return this.evaluate("document.documentElement.outerHTML");
  }

  // Scroll to position
  async scrollTo(x: number, y: number): Promise<void> {
    await this.evaluate(`window.scrollTo(${x}, ${y})`);
  }

  // Scroll to element
  async scrollToElement(selector: string): Promise<void> {
    const result = await this.evaluate(`
      (() => {
        const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
        if (!el) return false;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
      })()
    `);
    if (!result) {
      throw new Error(`Element not found: ${selector}`);
    }
  }

  // Get element bounding box
  async getBoundingBox(selector: string): Promise<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null> {
    return this.evaluate(`
      (() => {
        const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        };
      })()
    `);
  }

  // Focus element
  async focusElement(selector: string): Promise<void> {
    const result = await this.evaluate(`
      (() => {
        const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
        if (!el) return false;
        el.focus();
        return true;
      })()
    `);
    if (!result) {
      throw new Error(`Element not found: ${selector}`);
    }
  }

  // Select option in dropdown
  async selectOption(selector: string, value: string): Promise<void> {
    const result = await this.evaluate(`
      (() => {
        const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
        if (!el || el.tagName !== 'SELECT') return false;
        el.value = '${value.replace(/'/g, "\\'")}';
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()
    `);
    if (!result) {
      throw new Error(`Select element not found: ${selector}`);
    }
  }

  // Check/uncheck checkbox
  async setChecked(selector: string, checked: boolean): Promise<void> {
    const result = await this.evaluate(`
      (() => {
        const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
        if (!el || (el.type !== 'checkbox' && el.type !== 'radio')) return false;
        if (el.checked !== ${checked}) {
          el.click();
        }
        return true;
      })()
    `);
    if (!result) {
      throw new Error(`Checkbox/radio element not found: ${selector}`);
    }
  }

  // Clear input field
  async clearInput(selector: string): Promise<void> {
    const result = await this.evaluate(`
      (() => {
        const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
        if (!el) return false;
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()
    `);
    if (!result) {
      throw new Error(`Input element not found: ${selector}`);
    }
  }

  // Get element text content
  async getTextContent(selector: string): Promise<string | null> {
    return this.evaluate(`
      (() => {
        const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
        return el ? el.textContent : null;
      })()
    `);
  }

  // Get element attribute
  async getAttribute(selector: string, attribute: string): Promise<string | null> {
    return this.evaluate(`
      (() => {
        const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
        return el ? el.getAttribute('${attribute.replace(/'/g, "\\'")}') : null;
      })()
    `);
  }

  // Check if element exists
  async elementExists(selector: string): Promise<boolean> {
    return this.evaluate(`
      !!document.querySelector('${selector.replace(/'/g, "\\'")}')
    `);
  }

  // Check if element is visible
  async isVisible(selector: string): Promise<boolean> {
    return this.evaluate(`
      (() => {
        const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' &&
               style.visibility !== 'hidden' &&
               style.opacity !== '0' &&
               el.offsetParent !== null;
      })()
    `);
  }

  // Double click
  async doubleClick(x: number, y: number): Promise<void> {
    const client = this.getClient();
    await client.Input.dispatchMouseEvent({
      type: "mousePressed",
      x,
      y,
      button: "left",
      clickCount: 2,
    });
    await client.Input.dispatchMouseEvent({
      type: "mouseReleased",
      x,
      y,
      button: "left",
      clickCount: 2,
    });
  }

  // Double click element
  async doubleClickElement(selector: string): Promise<void> {
    const box = await this.evaluate(`
      (() => {
        const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2
        };
      })()
    `);

    if (!box) {
      throw new Error(`Element not found: ${selector}`);
    }

    await this.doubleClick(box.x, box.y);
  }

  // Hover over element
  async hover(selector: string): Promise<void> {
    const client = this.getClient();

    const box = await this.evaluate(`
      (() => {
        const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2
        };
      })()
    `);

    if (!box) {
      throw new Error(`Element not found: ${selector}`);
    }

    await client.Input.dispatchMouseEvent({
      type: "mouseMoved",
      x: box.x,
      y: box.y,
    });
  }

  // Drag and drop
  async dragAndDrop(
    fromSelector: string,
    toSelector: string
  ): Promise<void> {
    const client = this.getClient();

    const fromBox = await this.getBoundingBox(fromSelector);
    const toBox = await this.getBoundingBox(toSelector);

    if (!fromBox) {
      throw new Error(`Source element not found: ${fromSelector}`);
    }
    if (!toBox) {
      throw new Error(`Target element not found: ${toSelector}`);
    }

    const fromX = fromBox.x + fromBox.width / 2;
    const fromY = fromBox.y + fromBox.height / 2;
    const toX = toBox.x + toBox.width / 2;
    const toY = toBox.y + toBox.height / 2;

    // Move to source
    await client.Input.dispatchMouseEvent({
      type: "mouseMoved",
      x: fromX,
      y: fromY,
    });

    // Press
    await client.Input.dispatchMouseEvent({
      type: "mousePressed",
      x: fromX,
      y: fromY,
      button: "left",
      clickCount: 1,
    });

    // Move to target
    await client.Input.dispatchMouseEvent({
      type: "mouseMoved",
      x: toX,
      y: toY,
    });

    // Release
    await client.Input.dispatchMouseEvent({
      type: "mouseReleased",
      x: toX,
      y: toY,
      button: "left",
      clickCount: 1,
    });
  }

  // Wait for function to return truthy value
  async waitForFunction(
    fn: string,
    timeout: number = 30000,
    pollInterval: number = 100
  ): Promise<any> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const result = await this.evaluate(fn);
      if (result) {
        return result;
      }
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Timeout waiting for function: ${fn}`);
  }

  // PDF generation (if supported)
  async printToPDF(options: {
    landscape?: boolean;
    displayHeaderFooter?: boolean;
    printBackground?: boolean;
    scale?: number;
    paperWidth?: number;
    paperHeight?: number;
    marginTop?: number;
    marginBottom?: number;
    marginLeft?: number;
    marginRight?: number;
  } = {}): Promise<string> {
    const client = this.getClient();
    const result = await client.Page.printToPDF(options);
    return result.data;
  }

  // Execute CDP command directly
  async executeCDPCommand(domain: string, method: string, params: any = {}): Promise<any> {
    const client = this.getClient();
    const domainObj = (client as any)[domain];
    if (!domainObj || typeof domainObj[method] !== "function") {
      throw new Error(`Unknown CDP command: ${domain}.${method}`);
    }
    return domainObj[method](params);
  }

  // Wait utilities
  async waitForSelector(selector: string, timeout: number = 30000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const nodeId = await this.querySelector(selector);
      if (nodeId) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`Timeout waiting for selector: ${selector}`);
  }

  async waitForNavigation(timeout: number = 30000): Promise<void> {
    const client = this.getClient();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Navigation timeout"));
      }, timeout);

      const handler = () => {
        clearTimeout(timer);
        resolve();
      };

      (client.Page as any).on("loadEventFired", handler);

      // Clean up after timeout or success
      setTimeout(() => {
        (client.Page as any).off("loadEventFired", handler);
      }, timeout);
    });
  }
}
