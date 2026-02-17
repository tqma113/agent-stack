/**
 * Interactive chat example
 */

import * as readline from 'readline';
import { Agent } from '@agent-stack/index';

async function main() {
  const agent = new Agent({
    name: 'ChatAgent',
    model: 'gpt-4o-mini',
    systemPrompt: 'You are a helpful assistant.',
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('Chat started. Type "exit" to quit.\n');

  const prompt = () => {
    rl.question('You: ', async (input) => {
      if (input.toLowerCase() === 'exit') {
        rl.close();
        return;
      }

      try {
        process.stdout.write('Assistant: ');
        await agent.stream(input, {
          onToken: (token) => process.stdout.write(token),
        });
        console.log('\n');
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
      }

      prompt();
    });
  };

  prompt();
}

main().catch(console.error);
