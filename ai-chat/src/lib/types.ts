import { LanguageModelUsage, StepResult, ToolSet, UIMessage } from "ai";

export type MessageRole = 'user' | 'assistant' | 'system';

export type ImageAttachment = {
  id: string;
  url: string; // public URL under /public or data URL
  mimeType: string;
  width?: number;
  height?: number;
};

export type FileAttachment = {
  id: string;
  url: string; // data URL for now
  mimeType: string;
  name?: string;
};

export type TextContent = {
  type: 'text';
  text: string;
};

export type ImageContent = {
  type: 'image';
  image: ImageAttachment;
};

export type FileContent = {
  type: 'file';
  file: FileAttachment;
};

export type MessageContent = TextContent | ImageContent | FileContent;

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  model?: string;
  createdAt: string; // ISO timestamp
  reasoningTokens?: number;
  // If the provider returns cached input tokens (e.g. prompt caching), surface them
  cachedInputTokens?: number;
}

export interface ChatSummaryUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  reasoningTokens: number;
}

export interface Chat {
  id: string;
  title: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  messages: UIMessage[];
  usage: ChatSummaryUsage;
  systemPrompt?: string;
  // Optional thinking budget in tokens for reasoning-enabled models
  thinkingBudgetTokens?: number;
  // Optional JSON Schema (string) to request structured output for next reply
  structuredOutputSchema?: string;
  completions: (StepResult<ToolSet> & {steps: StepResult<ToolSet>[], totalUsage: LanguageModelUsage})[];
}

export interface ChatsFile {
  version: 1;
  chats: Chat[];
}

// Chat list item used in sidebar
export type ChatListItem = Pick<Chat, 'id' | 'title' | 'updatedAt' | 'usage'>;

// API chat payload equals full Chat
export type APIChat = Chat;


