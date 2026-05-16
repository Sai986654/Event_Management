import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';

const gateway = createOpenAI({
  baseURL: 'https://ai-gateway.vercel.sh/v1',
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

async function main() {
  const result = streamText({
    model: gateway('openai/gpt-5.4'),
    prompt: 'Write a haiku about programming.',
  });

  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }

  const usage = await result.usage;
  console.log('\n\nToken usage:', usage);
}

main().catch(console.error);
