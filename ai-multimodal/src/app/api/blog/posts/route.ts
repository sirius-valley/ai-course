import { NextRequest, NextResponse } from 'next/server';
import { dbManager } from '@/lib/database';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const posts = await dbManager.getAllBlogPosts(limit, offset);

    return NextResponse.json({
      posts,
      success: true,
    });
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch blog posts' },
      { status: 500 }
    );
  }
}
