/**
 * @ai-stack/assistant - Gateway Module
 */

export { createGateway, type GatewayInstance } from './gateway.js';
export { createSessionManager, type SessionManagerInstance, type SessionManagerConfig } from './session.js';
export { createRouter, type RouterInstance, type RouterConfig, type MessageHandler } from './router.js';
export {
  BaseAdapter,
  CLIAdapter,
  createCLIAdapter,
  TelegramAdapter,
  createTelegramAdapter,
  DiscordAdapter,
  createDiscordAdapter,
} from './adapters/index.js';
export type {
  GatewayConfig,
  SessionStrategy,
  ChannelConfigs,
  BaseChannelConfig,
  CLIChannelConfig,
  TelegramChannelConfig,
  DiscordChannelConfig,
  WhatsAppChannelConfig,
  IncomingMessage,
  ChannelType,
  MessageContent,
  FileAttachment,
  Session,
  IChannelAdapter,
} from './types.js';
