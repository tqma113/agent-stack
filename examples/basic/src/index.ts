/**
 * Basic example of @agent-stack/index
 */

import { Agent } from '@agent-stack/index';

async function main() {
  // Create agent
  const agent = new Agent({
    name: 'MyAgent',
    model: 'gpt-4o-mini',
    systemPrompt: 'You are a helpful assistant. Be concise.',
  });

  // Register a custom tool
  agent.registerTool({
    name: 'get_time',
    description: 'Get the current time',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      return `Current time: ${new Date().toLocaleString()}`;
    },
  });

  console.log('Agent created:', agent.getName());
  console.log('Tools:', agent.getTools().map(t => t.name).join(', '));

  // Simple chat
  console.log('\n--- Chat Test ---');
  const response = await agent.chat('Hello! What time is it?');
  console.log('Response:', response.content);

  if (response.toolCalls) {
    console.log('Tool calls:', response.toolCalls.map(tc => tc.name).join(', '));
  }
}

main().catch(console.error);
