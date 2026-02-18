/**
 * @ai-stack/assistant - CLI Channel Adapter
 *
 * Local command-line interface adapter.
 */

import * as readline from 'readline';
import type { IncomingMessage, MessageContent, CLIChannelConfig, ChannelType } from '../types.js';
import { BaseAdapter } from './base.js';

/**
 * CLI Adapter
 */
export class CLIAdapter extends BaseAdapter {
  readonly name = 'cli';
  readonly type: ChannelType = 'cli';

  private rl: readline.Interface | null = null;
  private prompt: string;
  private onInput: ((input: string) => void) | null = null;

  constructor(config: CLIChannelConfig = {}) {
    super();
    this.prompt = config.prompt || 'You: ';
  }

  async initialize(): Promise<void> {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.connected = true;
  }

  async close(): Promise<void> {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    this.connected = false;
  }

  async send(peerId: string, content: MessageContent): Promise<void> {
    if (content.text) {
      console.log(`\nAssistant: ${content.text}\n`);
    }
  }

  /**
   * Start interactive mode
   */
  startInteractive(onInput: (input: string) => void): void {
    if (!this.rl) {
      throw new Error('CLI adapter not initialized');
    }

    this.onInput = onInput;
    this.promptUser();
  }

  /**
   * Stop interactive mode
   */
  stopInteractive(): void {
    this.onInput = null;
  }

  /**
   * Prompt user for input
   */
  private promptUser(): void {
    if (!this.rl || !this.onInput) return;

    this.rl.question(this.prompt, async (input) => {
      const trimmed = input.trim();

      if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
        console.log('\nGoodbye!');
        await this.close();
        process.exit(0);
      }

      if (trimmed) {
        // Emit as incoming message
        const message: IncomingMessage = {
          id: this.generateMessageId(),
          channel: 'cli',
          peerId: 'local',
          content: { text: trimmed },
          timestamp: new Date(),
        };

        await this.emit(message);

        // Also call the onInput callback
        if (this.onInput) {
          this.onInput(trimmed);
        }
      }

      // Continue prompting
      this.promptUser();
    });
  }

  /**
   * Handle close event
   */
  onClose(callback: () => void): void {
    if (this.rl) {
      this.rl.on('close', callback);
    }
  }
}

/**
 * Create a CLI adapter
 */
export function createCLIAdapter(config?: CLIChannelConfig): CLIAdapter {
  return new CLIAdapter(config);
}
