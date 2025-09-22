import { NextRequest } from 'next/server';
import { createChat, listChats } from '@/lib/storage';

export async function GET() {
  const chats = await listChats();
  return Response.json({ chats });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as { title?: string }));
  const chat = await createChat(body.title);
  return Response.json({ chat }, { status: 201 });
}


