/**
 * @ai-stack/assistant - Session Manager
 *
 * Manages conversation sessions across channels.
 */

import type { Session, ChannelType, SessionStrategy } from './types.js';

/**
 * Session Manager Instance
 */
export interface SessionManagerInstance {
  /** Get or create a session */
  getOrCreate(channel: ChannelType, peerId: string): Session;
  /** Get an existing session */
  get(sessionId: string): Session | null;
  /** Update session data */
  update(sessionId: string, data: Record<string, unknown>): void;
  /** Touch session (update lastActivityAt) */
  touch(sessionId: string): void;
  /** Delete a session */
  delete(sessionId: string): void;
  /** Get all sessions */
  getAll(): Session[];
  /** Get sessions by channel */
  getByChannel(channel: ChannelType): Session[];
  /** Cleanup stale sessions */
  cleanup(maxAge: number): number;
}

/**
 * Session manager configuration
 */
export interface SessionManagerConfig {
  /** Session isolation strategy */
  strategy: SessionStrategy;
  /** Global session ID (for 'global' strategy) */
  globalSessionId?: string;
}

/**
 * Create a session manager
 */
export function createSessionManager(config: SessionManagerConfig): SessionManagerInstance {
  const { strategy, globalSessionId = 'global' } = config;

  const sessions = new Map<string, Session>();

  /**
   * Generate session ID based on strategy
   */
  function generateSessionId(channel: ChannelType, peerId: string): string {
    switch (strategy) {
      case 'global':
        return globalSessionId;
      case 'per-channel':
        return `channel-${channel}`;
      case 'per-peer':
      default:
        return `${channel}-${peerId}`;
    }
  }

  return {
    getOrCreate(channel: ChannelType, peerId: string): Session {
      const sessionId = generateSessionId(channel, peerId);

      let session = sessions.get(sessionId);
      if (!session) {
        session = {
          id: sessionId,
          channel,
          peerId,
          createdAt: new Date(),
          lastActivityAt: new Date(),
          data: {},
        };
        sessions.set(sessionId, session);
      }

      return session;
    },

    get(sessionId: string): Session | null {
      return sessions.get(sessionId) || null;
    },

    update(sessionId: string, data: Record<string, unknown>): void {
      const session = sessions.get(sessionId);
      if (session) {
        session.data = { ...session.data, ...data };
        session.lastActivityAt = new Date();
      }
    },

    touch(sessionId: string): void {
      const session = sessions.get(sessionId);
      if (session) {
        session.lastActivityAt = new Date();
      }
    },

    delete(sessionId: string): void {
      sessions.delete(sessionId);
    },

    getAll(): Session[] {
      return Array.from(sessions.values());
    },

    getByChannel(channel: ChannelType): Session[] {
      return Array.from(sessions.values()).filter((s) => s.channel === channel);
    },

    cleanup(maxAge: number): number {
      const now = Date.now();
      let cleaned = 0;

      for (const [id, session] of sessions) {
        if (now - session.lastActivityAt.getTime() > maxAge) {
          sessions.delete(id);
          cleaned++;
        }
      }

      return cleaned;
    },
  };
}
