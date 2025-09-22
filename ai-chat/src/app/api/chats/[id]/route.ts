import { getChat, updateChatConfig, deleteChat } from '@/lib/storage';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const chat = await getChat((await params).id);
  if (!chat) return new Response('Not found', { status: 404 });
  return Response.json({ chat });
}

export async function PATCH(req: Request, { params }: Params) {
  const body = await req.json().catch(() => ({} as { title?: string; systemPrompt?: string; thinkingBudgetTokens?: number; structuredOutputSchema?: string }));
  const updated = await updateChatConfig((await params).id, {
    title: body.title,
    systemPrompt: body.systemPrompt,
    thinkingBudgetTokens: typeof body.thinkingBudgetTokens === 'number' ? body.thinkingBudgetTokens : undefined,
    structuredOutputSchema: typeof body.structuredOutputSchema === 'string' ? body.structuredOutputSchema : undefined,
  });
  if (!updated) return new Response('Not found', { status: 404 });
  return Response.json({ chat: updated });
}

export async function DELETE(_req: Request, { params }: Params) {
  const ok = await deleteChat((await params).id);
  if (!ok) return new Response('Not found', { status: 404 });
  return new Response(null, { status: 204 });
}


