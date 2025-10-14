import { NextRequest, NextResponse } from 'next/server';
import { dbManager } from '@/lib/database';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const post = await dbManager.getBlogPostById(id);

    if (!post) {
      return NextResponse.json({ error: 'Blog post not found' }, { status: 404 });
    }

    if (!post.audioUrl) {
      return NextResponse.json({ error: 'No audio available for this post' }, { status: 404 });
    }

    return NextResponse.json({ 
      audioUrl: post.audioUrl,
      summary: post.summary,
    });
  } catch (error) {
    console.error(`Error fetching audio for post ${params.id}:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

