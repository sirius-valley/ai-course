"use client";
import { useEffect, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import type { APIChat } from '@/lib/types';

export function ChatSettings({ chat }: { chat: APIChat }) {
  const [systemDraft, setSystemDraft] = useState<string>(chat.systemPrompt || '');
  const [budgetDraft, setBudgetDraft] = useState<string>(String(chat.thinkingBudgetTokens || ''));
  const [schemaDraft, setSchemaDraft] = useState<string>(chat.structuredOutputSchema || '');

  // Sync local drafts when switching chats
  useEffect(() => {
    setSystemDraft(chat.systemPrompt || '');
    setBudgetDraft(String(chat.thinkingBudgetTokens || ''));
    setSchemaDraft(chat.structuredOutputSchema || '');
  }, [chat.id, chat.systemPrompt, chat.thinkingBudgetTokens, chat.structuredOutputSchema]);

  // Debounced auto-save
  useEffect(() => {
    const handle = setTimeout(async () => {
      const parsedBudget = Number(budgetDraft);
      const budgetVal = Number.isFinite(parsedBudget) && parsedBudget >= 0 ? parsedBudget : 0;
      const updates: { systemPrompt?: string; thinkingBudgetTokens?: number; structuredOutputSchema?: string } = {};
      if (systemDraft !== (chat.systemPrompt || '')) updates.systemPrompt = systemDraft;
      if (budgetVal !== (chat.thinkingBudgetTokens || 0)) updates.thinkingBudgetTokens = budgetVal;
      if (schemaDraft !== (chat.structuredOutputSchema || '')) updates.structuredOutputSchema = schemaDraft || '';
      if (Object.keys(updates).length > 0) {
        await fetch(`/api/chats/${chat.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
      }
    }, 800);
    return () => clearTimeout(handle);
  }, [chat.id, chat.systemPrompt, chat.thinkingBudgetTokens, chat.structuredOutputSchema, systemDraft, budgetDraft, schemaDraft]);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-medium mb-2">System prompt</div>
        <Textarea
          className="w-full h-40 bg-background border-border rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono text-xs"
          value={systemDraft}
          onChange={(e) => setSystemDraft(e.target.value)}
          placeholder="Set a custom system prompt for this chat"
        />
      </div>
      <div>
        <div className="text-sm font-medium mb-2">Thinking budget (tokens)</div>
        <input
          type="number"
          min={0}
          className="w-full rounded border-border px-3 py-2 bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="e.g. 256"
          value={budgetDraft}
          onChange={(e) => setBudgetDraft(e.target.value)}
        />
        <div className="text-xs opacity-70 mt-1">Applied on next message.</div>
      </div>
      <div>
        <div className="text-sm font-medium mb-2">Structured output (JSON Schema)</div>
        <Textarea
          className="w-full h-40 bg-background border-border rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono text-xs"
          value={schemaDraft}
          onChange={(e) => setSchemaDraft(e.target.value)}
          placeholder={'e.g. {"type": "object", "properties": {"location": {"type": "string"}}, "required": ["location"]}'}
        />
        <div className="text-xs opacity-70 mt-1">If provided, the next response will be a JSON object matching this schema. Clear to disable.</div>
      </div>
    </div>
  );
}


