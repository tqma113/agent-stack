/**
 * Permission Policy - Core permission checking and management
 */

import type {
  PermissionLevel,
  ToolCategory,
  PermissionRule,
  PermissionDecision,
  ConfirmationRequest,
  ConfirmationResponse,
  PermissionPolicyConfig,
  PermissionCallback,
  PermissionAuditEntry,
  PermissionPolicyInstance,
} from './types.js';

/**
 * Default permission rules for common tools
 */
export const DEFAULT_RULES: PermissionRule[] = [
  // Read operations - usually safe
  { tool: '*_read*', level: 'auto', category: 'read', description: 'Read operations' },
  { tool: '*_get*', level: 'auto', category: 'read', description: 'Get operations' },
  { tool: '*_list*', level: 'auto', category: 'read', description: 'List operations' },
  { tool: '*_search*', level: 'auto', category: 'read', description: 'Search operations' },
  { tool: '*_query*', level: 'auto', category: 'read', description: 'Query operations' },
  { tool: 'bash_pwd', level: 'auto', category: 'read', description: 'Get current directory' },
  { tool: 'bash_which', level: 'auto', category: 'read', description: 'Find command location' },
  { tool: 'bash_env', level: 'auto', category: 'read', description: 'Get environment variables' },

  // Git read operations
  { tool: 'mcp__git__git_status', level: 'auto', category: 'git', description: 'Git status' },
  { tool: 'mcp__git__git_log', level: 'auto', category: 'git', description: 'Git log' },
  { tool: 'mcp__git__git_diff*', level: 'auto', category: 'git', description: 'Git diff' },
  { tool: 'mcp__git__git_branch', level: 'auto', category: 'git', description: 'List branches' },
  { tool: 'mcp__git__git_show', level: 'auto', category: 'git', description: 'Show commit' },

  // Git write operations - require confirmation
  { tool: 'mcp__git__git_add', level: 'confirm', category: 'git', description: 'Stage files' },
  { tool: 'mcp__git__git_commit', level: 'confirm', category: 'git', description: 'Create commit' },
  { tool: 'mcp__git__git_reset', level: 'confirm', category: 'git', description: 'Reset staging' },
  { tool: 'mcp__git__git_checkout', level: 'confirm', category: 'git', description: 'Switch branch' },
  { tool: 'mcp__git__git_create_branch', level: 'confirm', category: 'git', description: 'Create branch' },

  // Bash operations - require confirmation
  { tool: 'bash_execute', level: 'confirm', category: 'execute', description: 'Execute command' },
  { tool: 'bash_script', level: 'confirm', category: 'execute', description: 'Execute script' },
  { tool: 'bash_background', level: 'confirm', category: 'execute', description: 'Start background process' },
  { tool: 'bash_kill', level: 'confirm', category: 'execute', description: 'Kill process' },
  { tool: 'bash_cd', level: 'confirm', category: 'execute', description: 'Change directory' },

  // Write operations - require confirmation
  { tool: '*_write*', level: 'confirm', category: 'write', description: 'Write operations' },
  { tool: '*_create*', level: 'confirm', category: 'write', description: 'Create operations' },
  { tool: '*_update*', level: 'confirm', category: 'write', description: 'Update operations' },
  { tool: '*_edit*', level: 'confirm', category: 'write', description: 'Edit operations' },

  // Network operations - require confirmation
  { tool: 'mcp__fetch__*', level: 'confirm', category: 'network', description: 'Fetch operations' },

  // Delete operations - require confirmation
  { tool: '*_delete*', level: 'confirm', category: 'admin', description: 'Delete operations' },
  { tool: '*_remove*', level: 'confirm', category: 'admin', description: 'Remove operations' },
];

/**
 * Default category patterns for auto-categorization
 */
export const DEFAULT_CATEGORY_PATTERNS: Array<{ pattern: string; category: ToolCategory }> = [
  { pattern: '*read*', category: 'read' },
  { pattern: '*get*', category: 'read' },
  { pattern: '*list*', category: 'read' },
  { pattern: '*search*', category: 'read' },
  { pattern: '*query*', category: 'read' },
  { pattern: '*write*', category: 'write' },
  { pattern: '*create*', category: 'write' },
  { pattern: '*update*', category: 'write' },
  { pattern: '*edit*', category: 'write' },
  { pattern: '*delete*', category: 'admin' },
  { pattern: '*remove*', category: 'admin' },
  { pattern: 'bash_*', category: 'execute' },
  { pattern: '*git*', category: 'git' },
  { pattern: '*fetch*', category: 'network' },
  { pattern: '*http*', category: 'network' },
];

/**
 * Default permission policy configuration
 */
export const DEFAULT_PERMISSION_CONFIG: PermissionPolicyConfig = {
  defaultLevel: 'confirm',
  rules: DEFAULT_RULES,
  sessionMemory: true,
  categoryDefaults: {
    read: 'auto',
    write: 'confirm',
    execute: 'confirm',
    network: 'confirm',
    git: 'confirm',
    admin: 'confirm',
    other: 'confirm',
  },
  categoryPatterns: DEFAULT_CATEGORY_PATTERNS,
};

/**
 * Match a tool name against a pattern
 * Supports: exact match, * wildcard (glob-style), regex (starts with ^)
 */
function matchPattern(toolName: string, pattern: string): boolean {
  // Regex pattern
  if (pattern.startsWith('^')) {
    try {
      const regex = new RegExp(pattern);
      return regex.test(toolName);
    } catch {
      return false;
    }
  }

  // Glob pattern with * wildcard
  if (pattern.includes('*')) {
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars except *
      .replace(/\*/g, '.*');                  // Convert * to .*
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(toolName);
  }

  // Exact match
  return toolName === pattern;
}

/**
 * Create a permission policy instance
 */
export function createPermissionPolicy(
  config: PermissionPolicyConfig = {}
): PermissionPolicyInstance {
  // Merge with defaults
  const effectiveConfig: PermissionPolicyConfig = {
    ...DEFAULT_PERMISSION_CONFIG,
    ...config,
    rules: config.rules ?? [...DEFAULT_RULES],
    categoryDefaults: {
      ...DEFAULT_PERMISSION_CONFIG.categoryDefaults,
      ...config.categoryDefaults,
    },
    categoryPatterns: config.categoryPatterns ?? [...DEFAULT_CATEGORY_PATTERNS],
  };

  // State
  const rules: PermissionRule[] = [...(effectiveConfig.rules ?? [])];
  const sessionApprovals = new Set<string>();
  const auditLog: PermissionAuditEntry[] = [];
  let confirmationCallback: PermissionCallback | null = null;

  /**
   * Determine category for a tool
   */
  function getToolCategory(toolName: string): ToolCategory {
    // Check rules first for explicit category
    for (const rule of rules) {
      if (matchPattern(toolName, rule.tool) && rule.category) {
        return rule.category;
      }
    }

    // Check category patterns
    for (const { pattern, category } of effectiveConfig.categoryPatterns ?? []) {
      if (matchPattern(toolName.toLowerCase(), pattern.toLowerCase())) {
        return category;
      }
    }

    return 'other';
  }

  /**
   * Check permission for a tool
   */
  function checkPermission(
    toolName: string,
    _args?: Record<string, unknown>
  ): PermissionDecision {
    // Check session approvals first
    if (effectiveConfig.sessionMemory && sessionApprovals.has(toolName)) {
      return {
        level: 'auto',
        matchedRule: null,
        toolName,
        category: getToolCategory(toolName),
      };
    }

    // Check rules in order
    for (const rule of rules) {
      if (matchPattern(toolName, rule.tool)) {
        return {
          level: rule.level,
          matchedRule: rule,
          toolName,
          category: rule.category ?? getToolCategory(toolName),
        };
      }
    }

    // Check category defaults
    const category = getToolCategory(toolName);
    const categoryLevel = effectiveConfig.categoryDefaults?.[category];
    if (categoryLevel) {
      return {
        level: categoryLevel,
        matchedRule: null,
        toolName,
        category,
      };
    }

    // Use default level
    return {
      level: effectiveConfig.defaultLevel ?? 'confirm',
      matchedRule: null,
      toolName,
      category,
    };
  }

  /**
   * Request user confirmation
   */
  async function requestConfirmation(
    request: ConfirmationRequest
  ): Promise<ConfirmationResponse> {
    if (!confirmationCallback) {
      // No callback set, deny by default for safety
      return {
        allowed: false,
        message: 'No confirmation callback set',
      };
    }

    const response = await confirmationCallback(request);

    // Handle session memory
    if (response.allowed && response.rememberForSession && effectiveConfig.sessionMemory) {
      sessionApprovals.add(request.toolName);
    }

    // Handle permanent memory (add rule)
    if (response.allowed && response.rememberPermanently) {
      addRule({
        tool: request.toolName,
        level: 'auto',
        description: 'User approved permanently',
      });
    }

    return response;
  }

  /**
   * Add a rule
   */
  function addRule(rule: PermissionRule): void {
    // Add at the beginning for higher priority
    rules.unshift(rule);
  }

  /**
   * Remove a rule by pattern
   */
  function removeRule(toolPattern: string): boolean {
    const index = rules.findIndex((r) => r.tool === toolPattern);
    if (index !== -1) {
      rules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Log an audit entry
   */
  function logAudit(entry: Omit<PermissionAuditEntry, 'timestamp'>): void {
    auditLog.push({
      ...entry,
      timestamp: Date.now(),
    });

    // Keep only last 1000 entries
    if (auditLog.length > 1000) {
      auditLog.shift();
    }
  }

  return {
    checkPermission,
    requestConfirmation,
    addRule,
    removeRule,
    getRules: () => [...rules],
    getToolCategory,
    approveForSession: (toolName: string) => sessionApprovals.add(toolName),
    isApprovedForSession: (toolName: string) => sessionApprovals.has(toolName),
    clearSessionApprovals: () => sessionApprovals.clear(),
    getAuditLog: () => [...auditLog],
    logAudit,
    clearAuditLog: () => auditLog.length = 0,
    setConfirmationCallback: (callback) => { confirmationCallback = callback; },
    getConfig: () => ({ ...effectiveConfig, rules: [...rules] }),
  };
}
