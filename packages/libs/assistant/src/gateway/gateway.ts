/**
 * @ai-stack/assistant - Gateway
 *
 * Multi-channel message gateway.
 */

import type {
  GatewayConfig,
  IChannelAdapter,
  IncomingMessage,
  MessageContent,
  ChannelType,
  Session,
} from './types.js';
import { createSessionManager, type SessionManagerInstance } from './session.js';
import { createRouter, type RouterInstance, type MessageHandler } from './router.js';
import { createCLIAdapter } from './adapters/cli.js';
import { createTelegramAdapter } from './adapters/telegram.js';
import { createDiscordAdapter } from './adapters/discord.js';

/**
 * Gateway Instance
 */
export interface GatewayInstance {
  /** Initialize the gateway */
  initialize(): Promise<void>;
  /** Close the gateway */
  close(): Promise<void>;

  /** Set the message handler */
  onMessage(handler: MessageHandler): void;
  /** Send a message to a peer */
  send(channel: ChannelType, peerId: string, content: MessageContent): Promise<void>;
  /** Broadcast to all sessions of a channel */
  broadcast(channel: ChannelType, content: MessageContent): Promise<void>;

  /** Get connected channels */
  getConnectedChannels(): ChannelType[];
  /** Get session manager */
  getSessionManager(): SessionManagerInstance;
  /** Get router */
  getRouter(): RouterInstance;

  /** Register a custom adapter */
  registerAdapter(adapter: IChannelAdapter): void;

  /** Start CLI interactive mode (if CLI channel is enabled) */
  startCLI(): void;
}

/**
 * Create a gateway instance
 */
export function createGateway(config: GatewayConfig = {}): GatewayInstance {
  const {
    sessionStrategy = 'per-peer',
    channels = {},
  } = config;

  const sessionManager = createSessionManager({ strategy: sessionStrategy });
  const router = createRouter({ sessionManager });
  const adapters = new Map<ChannelType, IChannelAdapter>();

  return {
    async initialize(): Promise<void> {
      // Create enabled adapters
      if (channels.cli?.enabled !== false) {
        const adapter = createCLIAdapter(channels.cli);
        adapters.set('cli', adapter);
      }

      if (channels.telegram?.enabled) {
        const adapter = createTelegramAdapter(channels.telegram);
        adapters.set('telegram', adapter);
      }

      if (channels.discord?.enabled) {
        const adapter = createDiscordAdapter(channels.discord);
        adapters.set('discord', adapter);
      }

      // Initialize all adapters
      for (const [type, adapter] of adapters) {
        try {
          await adapter.initialize();

          // Wire up message routing
          adapter.onMessage(async (msg: IncomingMessage) => {
            const response = await router.route(msg);
            if (response) {
              await adapter.send(msg.peerId, response);
            }
          });

          // Register sender
          router.registerSender(type, (peerId, content) => adapter.send(peerId, content));
        } catch (error) {
          console.error(`Failed to initialize ${type} adapter:`, error);
          adapters.delete(type);
        }
      }
    },

    async close(): Promise<void> {
      for (const adapter of adapters.values()) {
        try {
          await adapter.close();
        } catch (error) {
          console.error('Error closing adapter:', error);
        }
      }
      adapters.clear();
    },

    onMessage(handler: MessageHandler): void {
      router.setHandler(handler);
    },

    async send(channel: ChannelType, peerId: string, content: MessageContent): Promise<void> {
      await router.send(channel, peerId, content);
    },

    async broadcast(channel: ChannelType, content: MessageContent): Promise<void> {
      await router.broadcast(channel, content);
    },

    getConnectedChannels(): ChannelType[] {
      return Array.from(adapters.entries())
        .filter(([, adapter]) => adapter.isConnected())
        .map(([type]) => type);
    },

    getSessionManager(): SessionManagerInstance {
      return sessionManager;
    },

    getRouter(): RouterInstance {
      return router;
    },

    registerAdapter(adapter: IChannelAdapter): void {
      adapters.set(adapter.type, adapter);
    },

    startCLI(): void {
      const cliAdapter = adapters.get('cli');
      if (!cliAdapter) {
        throw new Error('CLI adapter not enabled');
      }

      // CLI adapter specific method
      if ('startInteractive' in cliAdapter) {
        (cliAdapter as any).startInteractive(() => {
          // Input is handled by onMessage
        });
      }
    },
  };
}
