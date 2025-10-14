-- Initialize database schema for AI Blog application

-- Table for storing generated blog posts
CREATE TABLE IF NOT EXISTS blog_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id VARCHAR(255) NOT NULL,
    topic TEXT NOT NULL,
    title TEXT NOT NULL,
    sections JSONB NOT NULL,
    summary TEXT,
    audio_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups by thread_id
CREATE INDEX IF NOT EXISTS idx_blog_posts_thread_id ON blog_posts(thread_id);

-- Index for faster sorting by creation date
CREATE INDEX IF NOT EXISTS idx_blog_posts_created_at ON blog_posts(created_at DESC);

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_blog_posts_updated_at 
    BEFORE UPDATE ON blog_posts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_blog_posts_topic ON blog_posts USING gin(to_tsvector('english', topic));
CREATE INDEX IF NOT EXISTS idx_blog_posts_title ON blog_posts USING gin(to_tsvector('english', title));
