import CDP from "chrome-remote-interface";

export interface RequestPattern {
  urlPattern?: string;
  resourceType?: ResourceType;
  requestStage?: "Request" | "Response";
}

export type ResourceType =
  | "Document"
  | "Stylesheet"
  | "Image"
  | "Media"
  | "Font"
  | "Script"
  | "TextTrack"
  | "XHR"
  | "Fetch"
  | "Prefetch"
  | "EventSource"
  | "WebSocket"
  | "Manifest"
  | "SignedExchange"
  | "Ping"
  | "CSPViolationReport"
  | "Preflight"
  | "Other";

export interface HeaderEntry {
  name: string;
  value: string;
}

export interface AuthChallenge {
  source?: "Server" | "Proxy";
  origin: string;
  scheme: string;
  realm: string;
}

export interface AuthChallengeResponse {
  response: "Default" | "CancelAuth" | "ProvideCredentials";
  username?: string;
  password?: string;
}

export interface RequestPausedEvent {
  requestId: string;
  request: Request;
  frameId: string;
  resourceType: ResourceType;
  responseErrorReason?: string;
  responseStatusCode?: number;
  responseStatusText?: string;
  responseHeaders?: HeaderEntry[];
  networkId?: string;
  redirectedRequestId?: string;
}

export interface Request {
  url: string;
  urlFragment?: string;
  method: string;
  headers: { [key: string]: string };
  postData?: string;
  hasPostData?: boolean;
  mixedContentType?: "blockable" | "optionally-blockable" | "none";
  initialPriority: "VeryLow" | "Low" | "Medium" | "High" | "VeryHigh";
  referrerPolicy: string;
  isLinkPreload?: boolean;
  trustTokenParams?: any;
  isSameSite?: boolean;
}

export class FetchDomain {
  constructor(private getClient: () => CDP.Client) {}

  /**
   * Enable fetch domain
   */
  async enable(options: {
    patterns?: RequestPattern[];
    handleAuthRequests?: boolean;
  } = {}): Promise<void> {
    const client = this.getClient();
    await (client as any).Fetch.enable(options);
  }

  /**
   * Disable fetch domain
   */
  async disable(): Promise<void> {
    const client = this.getClient();
    await (client as any).Fetch.disable();
  }

  /**
   * Continue request
   */
  async continueRequest(options: {
    requestId: string;
    url?: string;
    method?: string;
    postData?: string;
    headers?: HeaderEntry[];
    interceptResponse?: boolean;
  }): Promise<void> {
    const client = this.getClient();
    await (client as any).Fetch.continueRequest(options);
  }

  /**
   * Continue with auth
   */
  async continueWithAuth(requestId: string, authChallengeResponse: AuthChallengeResponse): Promise<void> {
    const client = this.getClient();
    await (client as any).Fetch.continueWithAuth({ requestId, authChallengeResponse });
  }

  /**
   * Continue response
   */
  async continueResponse(options: {
    requestId: string;
    responseCode?: number;
    responsePhrase?: string;
    responseHeaders?: HeaderEntry[];
    binaryResponseHeaders?: string;
  }): Promise<void> {
    const client = this.getClient();
    await (client as any).Fetch.continueResponse(options);
  }

  /**
   * Fail request
   */
  async failRequest(requestId: string, errorReason: string): Promise<void> {
    const client = this.getClient();
    await (client as any).Fetch.failRequest({ requestId, errorReason });
  }

  /**
   * Fulfill request
   */
  async fulfillRequest(options: {
    requestId: string;
    responseCode: number;
    responseHeaders?: HeaderEntry[];
    binaryResponseHeaders?: string;
    body?: string;
    responsePhrase?: string;
  }): Promise<void> {
    const client = this.getClient();
    await (client as any).Fetch.fulfillRequest(options);
  }

  /**
   * Get response body
   */
  async getResponseBody(requestId: string): Promise<{ body: string; base64Encoded: boolean }> {
    const client = this.getClient();
    return (client as any).Fetch.getResponseBody({ requestId });
  }

  /**
   * Take response body as stream
   */
  async takeResponseBodyAsStream(requestId: string): Promise<{ stream: string }> {
    const client = this.getClient();
    return (client as any).Fetch.takeResponseBodyAsStream({ requestId });
  }

  /**
   * Listen for request paused
   */
  onRequestPaused(callback: (params: RequestPausedEvent) => void): void {
    const client = this.getClient();
    (client as any).Fetch.on("requestPaused", callback);
  }

  /**
   * Listen for auth required
   */
  onAuthRequired(callback: (params: {
    requestId: string;
    request: Request;
    frameId: string;
    resourceType: ResourceType;
    authChallenge: AuthChallenge;
  }) => void): void {
    const client = this.getClient();
    (client as any).Fetch.on("authRequired", callback);
  }
}
