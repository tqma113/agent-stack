import CDP from "chrome-remote-interface";

export interface AffectedCookie {
  name: string;
  path: string;
  domain: string;
}

export interface AffectedRequest {
  requestId: string;
  url?: string;
}

export interface AffectedFrame {
  frameId: string;
}

export interface BlockedByResponseIssueDetails {
  request: AffectedRequest;
  parentFrame?: AffectedFrame;
  blockedFrame?: AffectedFrame;
  reason: "CoepFrameResourceNeedsCoepHeader" | "CoopSandboxedIFrameCannotNavigateToCoopPage" | "CorpNotSameOrigin" | "CorpNotSameOriginAfterDefaultedToSameOriginByCoep" | "CorpNotSameSite";
}

export interface ContentSecurityPolicyIssueDetails {
  blockedURL?: string;
  violatedDirective: string;
  isReportOnly: boolean;
  contentSecurityPolicyViolationType: "kInlineViolation" | "kEvalViolation" | "kURLViolation" | "kTrustedTypesSinkViolation" | "kTrustedTypesPolicyViolation" | "kWasmEvalViolation";
  frameAncestor?: AffectedFrame;
  sourceCodeLocation?: SourceCodeLocation;
  violatingNodeId?: number;
}

export interface SourceCodeLocation {
  scriptId?: string;
  url: string;
  lineNumber: number;
  columnNumber: number;
}

export interface MixedContentIssueDetails {
  resourceType?: string;
  resolutionStatus: "MixedContentBlocked" | "MixedContentAutomaticallyUpgraded" | "MixedContentWarning";
  insecureURL: string;
  mainResourceURL: string;
  request?: AffectedRequest;
  frame?: AffectedFrame;
}

export interface CookieIssueDetails {
  cookie?: AffectedCookie;
  rawCookieLine?: string;
  cookieWarningReasons: string[];
  cookieExclusionReasons: string[];
  operation: "SetCookie" | "ReadCookie";
  siteForCookies?: string;
  cookieUrl?: string;
  request?: AffectedRequest;
}

export interface InspectorIssue {
  code: string;
  details: InspectorIssueDetails;
  issueId?: string;
}

export interface InspectorIssueDetails {
  cookieIssueDetails?: CookieIssueDetails;
  mixedContentIssueDetails?: MixedContentIssueDetails;
  blockedByResponseIssueDetails?: BlockedByResponseIssueDetails;
  contentSecurityPolicyIssueDetails?: ContentSecurityPolicyIssueDetails;
  // Additional issue detail types can be added as needed
}

export class AuditsDomain {
  constructor(private getClient: () => CDP.Client) {}

  /**
   * Enable audits domain
   */
  async enable(): Promise<void> {
    const client = this.getClient();
    await (client as any).Audits.enable();
  }

  /**
   * Disable audits domain
   */
  async disable(): Promise<void> {
    const client = this.getClient();
    await (client as any).Audits.disable();
  }

  /**
   * Get encoded response
   */
  async getEncodedResponse(options: {
    requestId: string;
    encoding: "webp" | "jpeg" | "png";
    quality?: number;
    sizeOnly?: boolean;
  }): Promise<{ body?: string; originalSize: number; encodedSize: number }> {
    const client = this.getClient();
    return (client as any).Audits.getEncodedResponse(options);
  }

  /**
   * Run contrast check
   */
  async checkContrast(reportAAA?: boolean): Promise<void> {
    const client = this.getClient();
    await (client as any).Audits.checkContrast({ reportAAA });
  }

  /**
   * Check forms issues
   */
  async checkFormsIssues(): Promise<{ formIssues: any[] }> {
    const client = this.getClient();
    return (client as any).Audits.checkFormsIssues();
  }

  /**
   * Listen for issue added
   */
  onIssueAdded(callback: (params: { issue: InspectorIssue }) => void): void {
    const client = this.getClient();
    (client as any).Audits.on("issueAdded", callback);
  }
}
