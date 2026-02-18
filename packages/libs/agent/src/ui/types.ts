/**
 * UI Types for Agent Stack CLI
 */

export type Role = 'user' | 'agent' | 'system' | 'tool';

export interface Message {
  role: Role;
  content: string;
}

export interface ToolCallInfo {
  name: string;
  args: Record<string, unknown>;
  status?: 'pending' | 'running' | 'completed' | 'error';
  result?: string;
  duration?: number;
}

export interface HeaderInfo {
  version: string;
  model: string;
  toolCount: number;
  configPath?: string;
}

export interface FooterInfo {
  workDir?: string;
  sessionId?: string;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export type StreamState = 'idle' | 'thinking' | 'streaming' | 'tool';

export interface RenderOptions {
  width?: number;
  padding?: number;
  showTimestamp?: boolean;
}
