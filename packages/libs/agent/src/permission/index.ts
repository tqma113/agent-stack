/**
 * Permission system exports
 */

export {
  createPermissionPolicy,
  DEFAULT_RULES,
  DEFAULT_CATEGORY_PATTERNS,
  DEFAULT_PERMISSION_CONFIG,
} from './policy.js';

export type {
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
