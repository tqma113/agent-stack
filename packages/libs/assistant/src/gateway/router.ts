/**
 * @ai-stack/assistant - Message Router
 *
 * Routes messages between channels and the assistant.
 */

import type { IncomingMessage, MessageContent, ChannelType, Session } from './types.js';
import type { SessionManagerInstance } from './session.js';

/**
 * Message handler function type
 */
export type MessageHandler = (
  message: IncomingMessage,
  session: Session
) => Promise<MessageContent | string | void>;

/**
 * Router Instance
 */
export interface RouterInstance {
  /** Set the message handler */
  setHandler(handler: MessageHandler): void;
  /** Route an incoming message */
  route(message: IncomingMessage): Promise<MessageContent | null>;
  /** Send a message to a specific channel/peer */
  send(channel: ChannelType, peerId: string, content: MessageContent): Promise<void>;
  /** Broadcast to all sessions of a channel */
  broadcast(channel: ChannelType, content: MessageContent): Promise<void>;
  /** Register a send function for a channel */
  registerSender(channel: ChannelType, sender: (peerId: string, content: MessageContent) => Promise<void>): void;
}

/**
 * Router configuration
 */
export interface RouterConfig {
  sessionManager: SessionManagerInstance;
}

/**
 * Create a message router
 */
export function createRouter(config: RouterConfig): RouterInstance {
  const { sessionManager } = config;

  let handler: MessageHandler | null = null;
  const senders = new Map<ChannelType, (peerId: string, content: MessageContent) => Promise<void>>();

  return {
    setHandler(h: MessageHandler): void {
      handler = h;
    },

    async route(message: IncomingMessage): Promise<MessageContent | null> {
      if (!handler) {
        console.warn('No message handler registered');
        return null;
      }

      // Get or create session
      const session = sessionManager.getOrCreate(message.channel, message.peerId);

      // Update session activity
      sessionManager.touch(session.id);

      // Handle message
      const response = await handler(message, session);

      if (!response) {
        return null;
      }

      // Normalize response
      if (typeof response === 'string') {
        return { text: response };
      }

      return response;
    },

    async send(channel: ChannelType, peerId: string, content: MessageContent): Promise<void> {
      const sender = senders.get(channel);
      if (!sender) {
        throw new Error(`No sender registered for channel: ${channel}`);
      }
      await sender(peerId, content);
    },

    async broadcast(channel: ChannelType, content: MessageContent): Promise<void> {
      const sender = senders.get(channel);
      if (!sender) {
        throw new Error(`No sender registered for channel: ${channel}`);
      }

      const sessions = sessionManager.getByChannel(channel);
      await Promise.all(sessions.map((s) => sender(s.peerId, content)));
    },

    registerSender(
      channel: ChannelType,
      sender: (peerId: string, content: MessageContent) => Promise<void>
    ): void {
      senders.set(channel, sender);
    },
  };
}
