import CDP from "chrome-remote-interface";

export interface SecurityStateExplanation {
  securityState: SecurityState;
  title: string;
  summary: string;
  description: string;
  mixedContentType: "blockable" | "optionally-blockable" | "none";
  certificate: string[];
  recommendations?: string[];
}

export interface InsecureContentStatus {
  ranMixedContent: boolean;
  displayedMixedContent: boolean;
  containedMixedForm: boolean;
  ranContentWithCertErrors: boolean;
  displayedContentWithCertErrors: boolean;
  ranInsecureContentStyle: SecurityState;
  displayedInsecureContentStyle: SecurityState;
}

export interface CertificateSecurityState {
  protocol: string;
  keyExchange: string;
  keyExchangeGroup?: string;
  cipher: string;
  mac?: string;
  certificate: string[];
  subjectName: string;
  issuer: string;
  validFrom: number;
  validTo: number;
  certificateNetworkError?: string;
  certificateHasWeakSignature: boolean;
  certificateHasSha1Signature: boolean;
  modernSSL: boolean;
  obsoleteSslProtocol: boolean;
  obsoleteSslKeyExchange: boolean;
  obsoleteSslCipher: boolean;
  obsoleteSslSignature: boolean;
}

export interface SafetyTipInfo {
  safetyTipStatus: "badReputation" | "lookalike";
  safeUrl?: string;
}

export interface VisibleSecurityState {
  securityState: SecurityState;
  certificateSecurityState?: CertificateSecurityState;
  safetyTipInfo?: SafetyTipInfo;
  securityStateIssueIds: string[];
}

export type SecurityState = "unknown" | "neutral" | "insecure" | "secure" | "info" | "insecure-broken";

export class SecurityDomain {
  constructor(private getClient: () => CDP.Client) {}

  /**
   * Enable security domain
   */
  async enable(): Promise<void> {
    const client = this.getClient();
    await (client as any).Security.enable();
  }

  /**
   * Disable security domain
   */
  async disable(): Promise<void> {
    const client = this.getClient();
    await (client as any).Security.disable();
  }

  /**
   * Handle certificate error
   */
  async handleCertificateError(eventId: number, action: "continue" | "cancel"): Promise<void> {
    const client = this.getClient();
    await (client as any).Security.handleCertificateError({ eventId, action });
  }

  /**
   * Override certificate errors
   */
  async setOverrideCertificateErrors(override: boolean): Promise<void> {
    const client = this.getClient();
    await (client as any).Security.setOverrideCertificateErrors({ override });
  }

  /**
   * Ignore certificate errors
   */
  async setIgnoreCertificateErrors(ignore: boolean): Promise<void> {
    const client = this.getClient();
    await (client as any).Security.setIgnoreCertificateErrors({ ignore });
  }

  /**
   * Listen for certificate error
   */
  onCertificateError(callback: (params: { eventId: number; errorType: string; requestURL: string }) => void): void {
    const client = this.getClient();
    (client as any).Security.on("certificateError", callback);
  }

  /**
   * Listen for visible security state changed
   */
  onVisibleSecurityStateChanged(callback: (params: { visibleSecurityState: VisibleSecurityState }) => void): void {
    const client = this.getClient();
    (client as any).Security.on("visibleSecurityStateChanged", callback);
  }

  /**
   * Listen for security state changed
   */
  onSecurityStateChanged(callback: (params: {
    securityState: SecurityState;
    schemeIsCryptographic: boolean;
    explanations: SecurityStateExplanation[];
    insecureContentStatus: InsecureContentStatus;
    summary?: string;
  }) => void): void {
    const client = this.getClient();
    (client as any).Security.on("securityStateChanged", callback);
  }
}
