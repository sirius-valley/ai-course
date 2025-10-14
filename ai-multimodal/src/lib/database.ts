import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { Pool } from "pg";
import { BlogPost } from "./nodes/blog-content.node";

export class DatabaseManager {
  private pool: Pool;
  private checkpointer: PostgresSaver | null = null;
  private isInitialized = false;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL!,
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const client = await this.pool.connect();
      client.release();

      this.checkpointer = PostgresSaver.fromConnString(
        process.env.DATABASE_URL!
      );
      await this.checkpointer.setup();

      this.isInitialized = true;
    } catch (error) {
      console.error("Database initialization failed:", error);
      throw error;
    }
  }

  getCheckpointer(): PostgresSaver {
    if (!this.checkpointer) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
    return this.checkpointer;
  }

  async createBlogPost(data: {
    threadId: string;
    topic: string;
    title: string;
    sections: BlogPost["sections"];
    summary?: string;
    audioUrl?: string;
  }): Promise<{ id: string }> {
    const query = `
      INSERT INTO blog_posts (thread_id, topic, title, sections, summary, audio_url)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;
    const values = [
      data.threadId, 
      data.topic, 
      data.title, 
      JSON.stringify(data.sections),
      data.summary || null,
      data.audioUrl || null,
    ];
    
    const result = await this.pool.query(query, values);
    return { id: result.rows[0].id };
  }

  async getBlogPostById(id: string): Promise<BlogPost & { id: string; threadId: string; topic: string; createdAt: Date } | null> {
    const query = `
      SELECT id, thread_id as "threadId", topic, title, sections, summary, audio_url as "audioUrl", created_at as "createdAt"
      FROM blog_posts
      WHERE id = $1
    `;
    const result = await this.pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      threadId: row.threadId,
      topic: row.topic,
      title: row.title,
      sections: row.sections,
      summary: row.summary,
      audioUrl: row.audioUrl,
      createdAt: row.createdAt,
    };
  }

  async getBlogPostByThreadId(threadId: string): Promise<BlogPost & { id: string; threadId: string; topic: string; createdAt: Date } | null> {
    const query = `
      SELECT id, thread_id as "threadId", topic, title, sections, summary, audio_url as "audioUrl", created_at as "createdAt"
      FROM blog_posts
      WHERE thread_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await this.pool.query(query, [threadId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      threadId: row.threadId,
      topic: row.topic,
      title: row.title,
      sections: row.sections,
      summary: row.summary,
      audioUrl: row.audioUrl,
      createdAt: row.createdAt,
    };
  }

  async getAllBlogPosts(limit = 50, offset = 0): Promise<Array<{
    id: string;
    threadId: string;
    topic: string;
    title: string;
    sections: BlogPost["sections"];
    summary?: string;
    audioUrl?: string;
    createdAt: Date;
  }>> {
    const query = `
      SELECT id, thread_id as "threadId", topic, title, sections, summary, audio_url as "audioUrl", created_at as "createdAt"
      FROM blog_posts
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const result = await this.pool.query(query, [limit, offset]);
    
    return result.rows.map((row: {
      id: string;
      threadId: string;
      topic: string;
      title: string;
      sections: BlogPost["sections"];
      summary?: string;
      audioUrl?: string;
      createdAt: Date;
    }) => ({
      id: row.id,
      threadId: row.threadId,
      topic: row.topic,
      title: row.title,
      sections: row.sections,
      summary: row.summary,
      audioUrl: row.audioUrl,
      createdAt: row.createdAt,
    }));
  }

  async deleteBlogPost(id: string): Promise<boolean> {
    const query = `DELETE FROM blog_posts WHERE id = $1`;
    const result = await this.pool.query(query, [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async updateBlogPost(id: string, data: {
    sections: BlogPost["sections"];
  }): Promise<boolean> {
    const query = `UPDATE blog_posts SET sections = $1 WHERE id = $2`;
    const result = await this.pool.query(query, [JSON.stringify(data.sections), id]);
    return result.rowCount !== null && result.rowCount > 0;
  }
}

export const dbManager = new DatabaseManager();