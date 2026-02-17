#!/usr/bin/env node
/**
 * CLI entry point for agent-stack
 */

import * as readline from 'readline';
import { Agent } from './agent';

async function main() {
  const args = process.argv.slice(2);

  // Parse command line arguments
  const model = args.find((arg) => arg.startsWith('--model='))?.split('=')[1] ?? 'gpt-4o-mini';
  const systemPrompt = args.find((arg) => arg.startsWith('--system='))?.split('=')[1];

  console.log('🤖 Agent Stack CLI');
  console.log(`   Model: ${model}`);
  console.log('   Type "exit" or press Ctrl+C to quit.\n');

  const agent = new Agent({
    name: 'CLI Agent',
    model,
    systemPrompt,
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    rl.question('You: ', async (input) => {
      const trimmed = input.trim();

      if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
        console.log('\nGoodbye! 👋');
        rl.close();
        process.exit(0);
      }

      if (!trimmed) {
        prompt();
        return;
      }

      try {
        process.stdout.write('\nAgent: ');

        await agent.stream(trimmed, {
          onToken: (token) => {
            process.stdout.write(token);
          },
          onToolCall: (name, args) => {
            console.log(`\n[Calling tool: ${name}]`);
          },
          onToolResult: (name, result) => {
            console.log(`[Tool ${name} returned: ${result.slice(0, 100)}${result.length > 100 ? '...' : ''}]`);
          },
        });

        console.log('\n');
      } catch (error) {
        console.error('\nError:', error instanceof Error ? error.message : error);
        console.log();
      }

      prompt();
    });
  };

  prompt();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
