"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAutoScroll } from '@/lib/use-auto-scroll';
import type { APIChat } from '@/lib/types';

async function convertFilesToDataURLs(
  files: File[],
): Promise<
  { type: 'file'; filename: string; mediaType: string; url: string }[]
> {
  return Promise.all(
    files.map(
      file =>
        new Promise<{
          type: 'file';
          filename: string;
          mediaType: string;
          url: string;
        }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              type: 'file',
              filename: file.name,
              mediaType: file.type,
              url: reader.result as string,
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        }),
    ),
  );
}

export function ChatView({ chat, fetchChats, refreshChat }: { chat: APIChat; fetchChats: () => void; refreshChat: () => Promise<void> }) {
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { messages, sendMessage } = useChat({
    id: chat.id,
    transport: new DefaultChatTransport({
      api: `/api/chats/${chat.id}/reply`,
    }),
    messages: chat.messages,
    onFinish: async () => {
      await refreshChat();
      fetchChats();
    },
  });
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const { containerRef, bottomRef } = useAutoScroll<HTMLDivElement>();

  // Ensure we auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, bottomRef]);

  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const fileParts = files.length > 0 ? await convertFilesToDataURLs(files) : [];

    sendMessage({
      role: 'user',
      parts: [{ type: 'text', text: input }, ...fileParts],
    });

    setFiles([]);
    setInput('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [sendMessage, input, files]);

  return (
    <div className="h-full min-h-0 flex flex-col bg-background">
      <div ref={containerRef} className="flex-1 min-h-0 overflow-y-auto p-6 scrollbar-none">
        <div className={`w-full mx-auto`}>
          {messages.map((m) => (
            <div key={m.id} className="mb-4">
              <div className="text-xs opacity-60 mb-1">{m.role} • {new Date().toLocaleTimeString()}</div>
              <div className={`rounded-2xl px-4 py-3 shadow-sm border-border ${m.role === 'user' ? '' : 'bg-secondary'}`}>
                {m.parts.map(part => {
                  if (part.type === 'text') {
                    // Pretty-print JSON if applicable; otherwise preserve line breaks/indents
                    try {
                      const parsed = JSON.parse(part.text);
                      const pretty = JSON.stringify(parsed, null, 2);
                      return (
                        <pre key={`${m.id}-text`} className="whitespace-pre-wrap leading-relaxed text-xs md:text-sm bg-background/50 rounded p-3 border border-border overflow-x-auto">
                          {pretty}
                        </pre>
                      );
                    } catch {
                      return (
                        <pre key={`${m.id}-text`} className="whitespace-pre-wrap leading-relaxed text-sm">
                          {part.text}
                        </pre>
                      );
                    }
                  }
                  if (part.type === 'file') {
                    const isImage = typeof part.mediaType === 'string' && part.mediaType.startsWith('image/');
                    if (isImage && typeof part.url === 'string') {
                      return (
                        <div key={`${m.id}-${part.filename}`} className="mt-3">
                          <img src={part.url} alt={part.filename || 'image'} className="max-w-full h-auto rounded-md border border-border" />
                        </div>
                      );
                    }
                    return (
                      <div key={`${m.id}-${part.filename}`} className="mt-2 text-xs opacity-80">
                        <Badge>{part.filename}</Badge>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="border-t border-border p-3 bg-secondary">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex items-center gap-2">
          <Textarea
            ref={inputRef}
            rows={1}
            className="h-11 flex-1 resize-none rounded-full border-border px-4 py-2 bg-background shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Type a message... (Shift+Enter for newline)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitButtonRef.current?.click();
              }
            }}
          />
          <label className="px-3 py-2 border-border rounded-full cursor-pointer bg-background shadow-sm text-sm">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  const picked = Array.from(e.target.files);
                  setFiles((prev) => [...prev, ...picked]);
                  // allow picking the same file again
                  e.currentTarget.value = '';
                }
              }}
            />
            Image/PDF
          </label>
          <Button ref={submitButtonRef} type="submit" className="rounded-full">Send</Button>
        </form>
        {files.length > 0 && (
          <div className="max-w-3xl mx-auto mt-2 text-xs opacity-70 flex gap-2 flex-wrap">
            {files.map((f, idx) => (
              <Badge key={`${f.name}-${f.size}-${idx}`}>
                <span className="mr-1 truncate max-w-[200px] inline-block align-middle">{f.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${f.name}`}
                  className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-accent"
                  onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


