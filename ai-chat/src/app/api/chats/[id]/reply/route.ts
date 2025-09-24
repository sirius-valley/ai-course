import { NextRequest } from 'next/server';
import { getChat, updateChat, updateMessages, updateTokenUsage } from '@/lib/storage';
import { streamText, type UIMessage, convertToModelMessages, generateId, jsonSchema, Output } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

type Params = { params: Promise<{ id: string }> };

export const runtime = 'nodejs';

const google = createGoogleGenerativeAI({
  fetch: (url, options) => {
    console.log('fetch', url, options);
    return fetch(url, options);
  },
});

const MODELS = {
  'gemini-2.5-flash': google('gemini-2.5-flash'),
  default: google('gemini-2.5-flash'),
}

export async function POST(req: NextRequest, { params }: Params) {
  const chatId = (await params).id;
  const { messages: uiMessages }: { messages: UIMessage[] } = await req.json();

  // Get the chat from storage
  const chat = await getChat(chatId);
  if (!chat) return new Response('Not found', { status: 404 });
  const messages = convertToModelMessages(uiMessages);

  // Get the system prompt from the chat
  const system = chat.systemPrompt;
  const thinkingBudget = typeof chat.thinkingBudgetTokens === 'number' && chat.thinkingBudgetTokens > 0
    ? chat.thinkingBudgetTokens
    : undefined;

  // Update the chat with the new messages coming from the UI
  chat.messages = uiMessages;

  const result = streamText({
    // model selection
    model: MODELS['default'],
    // system prompt
    system,
    // messages
    messages,
    // temperature
    temperature: 0,
    // provider options (thinking, caching, etc)
    providerOptions: thinkingBudget
      ? {
          google: { 
            thinkingConfig: {
              thinkingBudget,
            } 
          },
        }
      : undefined,
    // structured output
    experimental_output: chat.structuredOutputSchema ? Output.object({schema: jsonSchema(JSON.parse(chat.structuredOutputSchema))}) : undefined,
    // on finish
    onFinish: async (completion) => {
      chat.updatedAt = new Date().toISOString();
      chat.messages.push({
        id: generateId(),
        role: 'assistant',
        parts: [{ type: 'text', text: completion.text }],
      });
      if (!chat.completions) chat.completions = [];
      chat.completions.push(completion);
      await updateChat(chatId, chat);
      await updateMessages(chatId, chat.messages);
      await updateTokenUsage(chatId, {
        inputTokens: completion.usage.inputTokens || 0,
        outputTokens: completion.usage.outputTokens || 0,
        totalTokens: completion.usage.totalTokens || 0,
        reasoningTokens: completion.usage.reasoningTokens || 0,
        createdAt: new Date().toISOString(),
      });
    },
  });

  // Return the result as a UI message stream response
  return result.toUIMessageStreamResponse();
}


