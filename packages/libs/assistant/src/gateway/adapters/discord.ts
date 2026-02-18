/**
 * @ai-stack/assistant - Discord Channel Adapter
 *
 * Discord bot adapter using discord.js.
 */

import type { IncomingMessage, MessageContent, DiscordChannelConfig, ChannelType } from '../types.js';
import { BaseAdapter } from './base.js';

/**
 * Discord Adapter
 */
export class DiscordAdapter extends BaseAdapter {
  readonly name = 'discord';
  readonly type: ChannelType = 'discord';

  private client: any = null; // Discord.Client instance
  private token: string;
  private allowedGuilds: string[];
  private allowedChannels: string[];

  constructor(config: DiscordChannelConfig) {
    super();
    this.token = config.token || process.env.DISCORD_BOT_TOKEN || '';
    this.allowedGuilds = config.allowedGuilds || [];
    this.allowedChannels = config.allowedChannels || [];
  }

  async initialize(): Promise<void> {
    if (!this.token) {
      throw new Error('Discord bot token is required. Set DISCORD_BOT_TOKEN or provide in config.');
    }

    try {
      // Dynamic import for optional dependency
      const { Client, GatewayIntentBits } = await import('discord.js');

      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.DirectMessages,
        ],
      });

      // Handle messages
      this.client.on('messageCreate', async (msg: any) => {
        // Ignore bot messages
        if (msg.author.bot) return;

        // Check guild/channel restrictions
        if (this.allowedGuilds.length > 0 && msg.guildId && !this.allowedGuilds.includes(msg.guildId)) {
          return;
        }

        if (this.allowedChannels.length > 0 && !this.allowedChannels.includes(msg.channelId)) {
          return;
        }

        // Check if bot is mentioned or in DM
        const isMentioned = msg.mentions.has(this.client.user?.id);
        const isDM = !msg.guildId;

        if (!isMentioned && !isDM) {
          return; // Only respond to mentions or DMs
        }

        // Remove bot mention from text
        let text = msg.content;
        if (isMentioned && this.client.user) {
          text = text.replace(new RegExp(`<@!?${this.client.user.id}>`, 'g'), '').trim();
        }

        // Extract images from attachments
        const images = msg.attachments
          .filter((a: any) => a.contentType?.startsWith('image/'))
          .map((a: any) => a.url);

        const message: IncomingMessage = {
          id: this.generateMessageId(),
          channel: 'discord',
          peerId: `${msg.channelId}:${msg.author.id}`,
          content: {
            text,
            images: images.length > 0 ? images : undefined,
          },
          timestamp: msg.createdAt,
          raw: msg,
        };

        await this.emit(message);
      });

      // Ready event
      this.client.once('ready', () => {
        console.log(`Discord bot logged in as ${this.client.user?.tag}`);
        this.connected = true;
      });

      // Login
      await this.client.login(this.token);
    } catch (error) {
      if ((error as any)?.code === 'MODULE_NOT_FOUND') {
        throw new Error('Discord adapter requires discord.js package. Install with: npm install discord.js');
      }
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
    this.connected = false;
  }

  async send(peerId: string, content: MessageContent): Promise<void> {
    if (!this.client) {
      throw new Error('Discord adapter not initialized');
    }

    const [channelId] = peerId.split(':');
    const channel = await this.client.channels.fetch(channelId);

    if (!channel?.isTextBased?.()) {
      throw new Error(`Channel ${channelId} is not a text channel`);
    }

    if (content.text) {
      // Split long messages (Discord limit is 2000 chars)
      const chunks = splitMessage(content.text, 2000);
      for (const chunk of chunks) {
        await channel.send(chunk);
      }
    }

    // Send files if any
    if (content.files?.length) {
      await channel.send({
        files: content.files.map((f) => ({ attachment: f.url, name: f.name })),
      });
    }
  }
}

/**
 * Split a message into chunks
 */
function splitMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try to split at a newline
    let splitIndex = remaining.lastIndexOf('\n', maxLength);
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      // Try to split at a space
      splitIndex = remaining.lastIndexOf(' ', maxLength);
    }
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      // Hard split
      splitIndex = maxLength;
    }

    chunks.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex).trimStart();
  }

  return chunks;
}

/**
 * Create a Discord adapter
 */
export function createDiscordAdapter(config: DiscordChannelConfig): DiscordAdapter {
  return new DiscordAdapter(config);
}
