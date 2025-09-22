"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash } from "lucide-react";
import { ChatView } from "@/components/ChatView";
import type { ChatListItem, APIChat } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BoldJson, type JSONLike } from "@/components/BoldJson";
import { ChatSettings } from "@/components/ChatSettings";

 

export default function Home() {
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chat, setChat] = useState<APIChat | null>(null);
  const [rightOpen, setRightOpen] = useState(true);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState<string>("");

  const fetchChats = useCallback(async () => {
    const res = await fetch("/api/chats");
    const data = await res.json();
    setChats(data.chats as ChatListItem[]);
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  const refreshSelectedChat = useCallback(async () => {
    if (!selectedId) return;
    const res = await fetch(`/api/chats/${selectedId}`);
    if (res.ok) {
      const data = await res.json();
      setChat(data.chat as APIChat);
    }
  }, [selectedId]);

  useEffect(() => {
    (async () => {
      if (!selectedId) return setChat(null);
      const res = await fetch(`/api/chats/${selectedId}`);
      if (res.ok) {
        const data = await res.json();
        setChat(data.chat as APIChat);
      }
    })();
  }, [selectedId]);

  // Settings state moved into ChatSettings component

  const onNewChat = useCallback(async () => {
    const res = await fetch("/api/chats", { method: "POST" });
    const data = await res.json();
    await fetchChats();
    setSelectedId(data.chat.id as string);
  }, [fetchChats]);

  const beginEditTitle = useCallback(() => {
    if (!chat) return;
    setTitleDraft(chat.title);
    setIsEditingTitle(true);
  }, [chat]);

  const saveTitle = useCallback(async () => {
    if (!chat) return setIsEditingTitle(false);
    const newTitle = titleDraft.trim();
    setIsEditingTitle(false);
    if (!newTitle || newTitle === chat.title) return;
    await fetch(`/api/chats/${chat.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    });
    await fetchChats();
    await (async () => {
      const res = await fetch(`/api/chats/${chat.id}`);
      if (res.ok) {
        const data = await res.json();
        setChat(data.chat as APIChat);
      }
    })();
  }, [chat, titleDraft, fetchChats]);

  return (
    <div className="flex h-screen">
      <aside className="w-72 border-r border-border flex flex-col bg-secondary">
        <div className="p-3 border-b border-border flex justify-between items-center">
          <h1 className="font-semibold">Chats</h1>
          <Button size="sm" onClick={onNewChat}>New</Button>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          {chats.map((c) => (
            <div
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`block w-full text-left px-3 py-2 border-b border-border hover:bg-accent cursor-pointer ${selectedId === c.id ? 'bg-accent' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{c.title}</div>
                  <div className="text-xs opacity-60">{new Date(c.updatedAt).toLocaleString()}</div>
                  <div className="text-xs mt-1">Tokens: {c.usage.totalTokens}</div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await fetch(`/api/chats/${c.id}`, { method: 'DELETE' });
                    await fetchChats();
                    if (selectedId === c.id) setSelectedId(null);
                  }}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </ScrollArea>
      </aside>
      {chat ? (
        <main className="flex-1 min-h-0 flex flex-col bg-background overflow-hidden">
          <div className="px-6 py-3 border-b border-border flex items-center justify-between">
            <div className="min-w-0">
              {isEditingTitle ? (
                <input
                  autoFocus
                  className="text-lg font-semibold bg-background border-border rounded px-2 py-1 max-w-[60vw] w-[420px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); void saveTitle(); }
                    if (e.key === 'Escape') { e.preventDefault(); setIsEditingTitle(false); }
                  }}
                />
              ) : (
                <h2
                  className="text-lg font-semibold truncate cursor-pointer"
                  title={chat.title}
                  onClick={beginEditTitle}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); beginEditTitle(); } }}
                >
                  {chat.title}
                </h2>
              )}
              <div className="opacity-70 text-xs mt-1">Total tokens: {chat.usage.totalTokens} (Input: {chat.usage.inputTokens}, Output: {chat.usage.outputTokens}{typeof chat.usage.reasoningTokens === 'number' ? `, Think: ${chat.usage.reasoningTokens}` : ''})</div>
            </div>
            <div className="flex items-center gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm">View completions</Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle className="font-semibold text-base">Completions</DialogTitle>
                    <DialogDescription className="text-xs opacity-60">{chat?.completions?.length || 0} items</DialogDescription>
                  </DialogHeader>
                  <div className="max-h-[70vh] overflow-y-auto pr-1">
                    {chat?.completions && chat.completions.length > 0 ? (
                      <div className="space-y-2">
                        {chat.completions.map((c, idx) => (
                          <details key={idx} className="rounded border border-border bg-background">
                            <summary className="cursor-pointer px-3 py-2 text-sm font-medium flex items-center justify-between">
                              <span>Completion {idx + 1}</span>
                              <span className="opacity-60 text-xs">Tokens: in {c.usage.inputTokens ?? 0}, out {c.usage.outputTokens ?? 0}</span>
                            </summary>
                            <div className="px-3 py-2 space-y-2">
                              <BoldJson value={c as unknown as JSONLike} />
                            </div>
                          </details>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm opacity-70">No completions yet.</div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="ghost" size="sm" onClick={() => setRightOpen((v) => !v)}>{rightOpen ? 'Hide' : 'Show'} panel</Button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ChatView chat={chat} fetchChats={fetchChats} refreshChat={refreshSelectedChat} />
          </div>
        </main>
      ) : (
        <main className="flex-1 min-h-0 flex flex-col bg-background">
          <div className="h-full grid place-items-center opacity-70">
            <div>
              <p className="text-center">Create a chat to begin</p>
            </div>
          </div>
        </main>
      )}
      {chat && (
        <aside className={` border-l border-border bg-secondary flex flex-col min-h-0 transition-all duration-300 ${rightOpen ? 'w-[360px] opacity-100' : 'w-0 opacity-0'}`}>
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold">Settings</h3>
          </div>
          <ScrollArea className="flex-1 min-h-0 p-4 space-y-4">
            {chat && <ChatSettings chat={chat} />}
          </ScrollArea>
        </aside>
      )}
    </div>
  );
}
