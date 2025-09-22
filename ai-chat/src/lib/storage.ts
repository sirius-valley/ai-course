import fs from 'node:fs/promises';
import path from 'node:path';
import { Chat, ChatsFile, TokenUsage } from './types';
import { UIMessage } from 'ai';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'chats.json');

async function ensureStorage(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {}
  try {
    await fs.access(DATA_FILE);
  } catch {
    const initial: ChatsFile = { version: 1, chats: [] };
    await fs.writeFile(DATA_FILE, JSON.stringify(initial, null, 2), 'utf8');
  }
}

async function readAll(): Promise<ChatsFile> {
  await ensureStorage();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  try {
    const parsed = JSON.parse(raw) as ChatsFile;
    if (!parsed.chats) return { version: 1, chats: [] };
    return parsed;
  } catch {
    return { version: 1, chats: [] };
  }
}

async function writeAll(file: ChatsFile): Promise<void> {
  await fs.writeFile(DATA_FILE, JSON.stringify(file, null, 2), 'utf8');
}

function generateId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function listChats(): Promise<Pick<Chat, 'id' | 'title' | 'updatedAt' | 'usage' | 'completions'>[]> {
  const data = await readAll();
  return data.chats
    .map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt, usage: c.usage, completions: c.completions }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getChat(chatId: string): Promise<Chat | undefined> {
  const data = await readAll();
  return data.chats.find((c) => c.id === chatId);
}

export async function createChat(initialTitle?: string): Promise<Chat> {
  const now = new Date().toISOString();
  const chat: Chat = {
    id: generateId(),
    title: initialTitle?.trim() || 'New Chat',
    createdAt: now,
    updatedAt: now,
    messages: [],
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, reasoningTokens: 0 },
    systemPrompt: '',
    completions: [],
  };
  const data = await readAll();
  data.chats.unshift(chat);
  await writeAll(data);
  return chat;
}

export async function updateMessages(chatId: string, messages: UIMessage[]): Promise<boolean> {
  const data = await readAll();
  const chat = data.chats.find((c) => c.id === chatId);
  if (!chat) return false;
  chat.messages = messages;
  chat.updatedAt = new Date().toISOString();
  await writeAll(data);
  return true;
}

export async function updateTokenUsage(chatId: string, usage: TokenUsage): Promise<boolean> {
  const data = await readAll();
  const chat = data.chats.find((c) => c.id === chatId);
  if (!chat) return false;
  chat.usage = {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    reasoningTokens: usage.reasoningTokens ?? 0,
  };
  chat.updatedAt = new Date().toISOString();
  await writeAll(data);
  return true;
}

export async function updateChat(chatId: string, chat: Chat): Promise<boolean> {
  const data = await readAll();
  const index = data.chats.findIndex((c) => c.id === chatId);
  if (index === -1) return false;
  data.chats[index] = chat;
  await writeAll(data);
  return true;
}

export async function renameChat(chatId: string, title: string): Promise<boolean> {
  const data = await readAll();
  const chat = data.chats.find((c) => c.id === chatId);
  if (!chat) return false;
  chat.title = title;
  chat.updatedAt = new Date().toISOString();
  await writeAll(data);
  return true;
}

export async function updateChatConfig(
  chatId: string,
  updates: { title?: string; systemPrompt?: string; thinkingBudgetTokens?: number; structuredOutputSchema?: string }
): Promise<Chat | undefined> {
  const data = await readAll();
  const chat = data.chats.find((c) => c.id === chatId);
  if (!chat) return undefined;
  if (typeof updates.title === 'string') chat.title = updates.title;
  if (typeof updates.systemPrompt === 'string') chat.systemPrompt = updates.systemPrompt;
  if (typeof updates.thinkingBudgetTokens === 'number') chat.thinkingBudgetTokens = updates.thinkingBudgetTokens;
  if (typeof updates.structuredOutputSchema === 'string') chat.structuredOutputSchema = updates.structuredOutputSchema;
  chat.updatedAt = new Date().toISOString();
  await writeAll(data);
  return chat;
}

export async function deleteChat(chatId: string): Promise<boolean> {
  const data = await readAll();
  const before = data.chats.length;
  data.chats = data.chats.filter((c) => c.id !== chatId);
  if (data.chats.length === before) return false;
  await writeAll(data);
  return true;
}


