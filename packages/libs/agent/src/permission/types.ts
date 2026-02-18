/**
 * Permission system types
 */

/**
 * Permission levels for tool execution
 */
export type PermissionLevel =
  | 'auto'      // Auto-approve, execute without confirmation
  | 'confirm'   // Require user confirmation before execution
  | 'deny';     // Always deny execution

/**
 * Tool categories for grouping permissions
 */
export type ToolCategory =
  | 'read'      // Read-only operations (file read, search, query)
  | 'write'     // Write operations (file write, create, update)
  | 'execute'   // Command execution (bash, scripts)
  | 'network'   // Network operations (fetch, API calls)
  | 'git'       // Git operations (commit, push, branch)
  | 'admin'     // Administrative operations (delete, config changes)
  | 'other';    // Uncategorized

/**
 * Permission rule for matching tools
 */
export interface PermissionRule {
  /** Tool name pattern (exact match, glob with *, or regex) */
  tool: string;
  /** Permission level for matched tools */
  level: PermissionLevel;
  /** Optional category for documentation */
  category?: ToolCategory;
  /** Optional description for this rule */
  description?: string;
}

/**
 * Permission decision result
 */
export interface PermissionDecision {
  /** The decided permission level */
  level: PermissionLevel;
  /** Which rule matched (null if using default) */
  matchedRule: PermissionRule | null;
  /** Tool name that was checked */
  toolName: string;
  /** Tool category if determined */
  category?: ToolCategory;
}

/**
 * Confirmation request for user
 */
export interface ConfirmationRequest {
  /** Tool name */
  toolName: string;
  /** Tool arguments */
  args: Record<string, unknown>;
  /** Tool description */
  description?: string;
  /** Matched rule */
  rule?: PermissionRule;
  /** Suggested action description */
  actionDescription?: string;
}

/**
 * Confirmation response from user
 */
export interface ConfirmationResponse {
  /** Whether to allow this execution */
  allowed: boolean;
  /** Whether to remember this decision for the session */
  rememberForSession?: boolean;
  /** Whether to remember this decision permanently (add to rules) */
  rememberPermanently?: boolean;
  /** Custom message from user */
  message?: string;
}

/**
 * Permission policy configuration
 */
export interface PermissionPolicyConfig {
  /** Default permission level for unmatched tools */
  defaultLevel?: PermissionLevel;
  /** Permission rules (evaluated in order, first match wins) */
  rules?: PermissionRule[];
  /** Whether to auto-approve tools that were approved once in this session */
  sessionMemory?: boolean;
  /** Category-level defaults (applied before rules, after defaultLevel) */
  categoryDefaults?: Partial<Record<ToolCategory, PermissionLevel>>;
  /** Tool name patterns to auto-categorize */
  categoryPatterns?: Array<{
    pattern: string;
    category: ToolCategory;
  }>;
}

/**
 * Permission callback for user confirmation
 */
export type PermissionCallback = (
  request: ConfirmationRequest
) => Promise<ConfirmationResponse>;

/**
 * Permission audit log entry
 */
export interface PermissionAuditEntry {
  /** Timestamp */
  timestamp: number;
  /** Tool name */
  toolName: string;
  /** Tool arguments */
  args: Record<string, unknown>;
  /** Decision made */
  decision: PermissionDecision;
  /** User confirmation result (if applicable) */
  userResponse?: ConfirmationResponse;
  /** Whether tool was actually executed */
  executed: boolean;
  /** Execution result or error */
  result?: string;
  /** Error if execution failed */
  error?: string;
}

/**
 * Permission policy instance interface
 */
export interface PermissionPolicyInstance {
  /** Check permission for a tool */
  checkPermission(toolName: string, args?: Record<string, unknown>): PermissionDecision;

  /** Request user confirmation */
  requestConfirmation(request: ConfirmationRequest): Promise<ConfirmationResponse>;

  /** Add a rule dynamically */
  addRule(rule: PermissionRule): void;

  /** Remove a rule by tool pattern */
  removeRule(toolPattern: string): boolean;

  /** Get all rules */
  getRules(): PermissionRule[];

  /** Get category for a tool */
  getToolCategory(toolName: string): ToolCategory;

  /** Mark a tool as approved for this session */
  approveForSession(toolName: string): void;

  /** Check if tool is approved for this session */
  isApprovedForSession(toolName: string): boolean;

  /** Clear session approvals */
  clearSessionApprovals(): void;

  /** Get audit log */
  getAuditLog(): PermissionAuditEntry[];

  /** Log an audit entry */
  logAudit(entry: Omit<PermissionAuditEntry, 'timestamp'>): void;

  /** Clear audit log */
  clearAuditLog(): void;

  /** Set the confirmation callback */
  setConfirmationCallback(callback: PermissionCallback | null): void;

  /** Get current config */
  getConfig(): PermissionPolicyConfig;
}
