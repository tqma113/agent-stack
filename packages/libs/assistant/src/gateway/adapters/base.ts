/**
 * @ai-stack/assistant - Base Channel Adapter
 *
 * Abstract base class for channel adapters.
 */

import type { IChannelAdapter, IncomingMessage, MessageContent, ChannelType } from '../types.js';

/**
 * Base adapter that implements common functionality
 */
export abstract class BaseAdapter implements IChannelAdapter {
  abstract readonly name: string;
  abstract readonly type: ChannelType;

  protected messageHandler: ((msg: IncomingMessage) => Promise<void>) | null = null;
  protected connected = false;

  abstract initialize(): Promise<void>;
  abstract close(): Promise<void>;
  abstract send(peerId: string, content: MessageContent): Promise<void>;

  onMessage(handler: (msg: IncomingMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Emit an incoming message to the handler
   */
  protected async emit(message: IncomingMessage): Promise<void> {
    if (this.messageHandler) {
      await this.messageHandler(message);
    }
  }

  /**
   * Generate a unique message ID
   */
  protected generateMessageId(): string {
    return `${this.type}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }
}
