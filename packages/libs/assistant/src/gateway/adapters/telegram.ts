/**
 * @ai-stack/assistant - Telegram Channel Adapter
 *
 * Telegram bot adapter using Telegraf.
 */

import type { IncomingMessage, MessageContent, TelegramChannelConfig, ChannelType } from '../types.js';
import { BaseAdapter } from './base.js';

/**
 * Telegram Adapter
 */
export class TelegramAdapter extends BaseAdapter {
  readonly name = 'telegram';
  readonly type: ChannelType = 'telegram';

  private bot: any = null; // Telegraf instance
  private token: string;
  private allowedUsers: number[];

  constructor(config: TelegramChannelConfig) {
    super();
    this.token = config.token || process.env.TELEGRAM_BOT_TOKEN || '';
    this.allowedUsers = config.allowedUsers || [];
  }

  async initialize(): Promise<void> {
    if (!this.token) {
      throw new Error('Telegram bot token is required. Set TELEGRAM_BOT_TOKEN or provide in config.');
    }

    try {
      // Dynamic import for optional dependency
      const { Telegraf } = await import('telegraf');
      this.bot = new Telegraf(this.token);

      // Handle text messages
      this.bot.on('text', async (ctx: any) => {
        const userId = ctx.from?.id;

        // Check if user is allowed
        if (this.allowedUsers.length > 0 && !this.allowedUsers.includes(userId)) {
          return; // Silently ignore unauthorized users
        }

        const message: IncomingMessage = {
          id: this.generateMessageId(),
          channel: 'telegram',
          peerId: String(userId),
          content: { text: ctx.message.text },
          timestamp: new Date(ctx.message.date * 1000),
          raw: ctx,
        };

        await this.emit(message);
      });

      // Handle photos
      this.bot.on('photo', async (ctx: any) => {
        const userId = ctx.from?.id;

        if (this.allowedUsers.length > 0 && !this.allowedUsers.includes(userId)) {
          return;
        }

        const photos = ctx.message.photo;
        const largestPhoto = photos[photos.length - 1];
        const fileLink = await ctx.telegram.getFileLink(largestPhoto.file_id);

        const message: IncomingMessage = {
          id: this.generateMessageId(),
          channel: 'telegram',
          peerId: String(userId),
          content: {
            text: ctx.message.caption || '',
            images: [fileLink.href],
          },
          timestamp: new Date(ctx.message.date * 1000),
          raw: ctx,
        };

        await this.emit(message);
      });

      // Launch bot
      await this.bot.launch();
      this.connected = true;

      // Graceful stop
      process.once('SIGINT', () => this.bot.stop('SIGINT'));
      process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
    } catch (error) {
      if ((error as any)?.code === 'MODULE_NOT_FOUND') {
        throw new Error('Telegram adapter requires telegraf package. Install with: npm install telegraf');
      }
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.bot) {
      this.bot.stop();
      this.bot = null;
    }
    this.connected = false;
  }

  async send(peerId: string, content: MessageContent): Promise<void> {
    if (!this.bot) {
      throw new Error('Telegram adapter not initialized');
    }

    const chatId = parseInt(peerId, 10);

    if (content.text) {
      await this.bot.telegram.sendMessage(chatId, content.text, {
        parse_mode: 'Markdown',
      });
    }

    // Send images if any
    if (content.images?.length) {
      for (const image of content.images) {
        await this.bot.telegram.sendPhoto(chatId, image);
      }
    }

    // Send files if any
    if (content.files?.length) {
      for (const file of content.files) {
        await this.bot.telegram.sendDocument(chatId, file.url);
      }
    }
  }
}

/**
 * Create a Telegram adapter
 */
export function createTelegramAdapter(config: TelegramChannelConfig): TelegramAdapter {
  return new TelegramAdapter(config);
}
