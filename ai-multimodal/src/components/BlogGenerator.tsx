"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { BlogPost } from '@/lib/nodes/blog-content.node';
import { BlogPostDisplay } from '@/components/BlogPostDisplay';
import { Loader2, FileText, Trash2 } from 'lucide-react';

interface GenerationHistory {
  id: string;
  topic: string;
  blogPost: BlogPost;
  timestamp: Date;
  threadId: string;
}

type StreamState = {
  partialBlogPost: BlogPost | null;
  summary: string | undefined;
  audioUrl: string | undefined;
  postId: string | undefined;
  threadId: string;
  audioReady: boolean;
};

const createBlogPostUpdate = (
  state: StreamState,
  overrides: Partial<BlogPost> = {}
): BlogPost => ({
  title: state.partialBlogPost!.title,
  sections: state.partialBlogPost!.sections,
  summary: state.summary,
  audioUrl: state.audioUrl,
  ...overrides,
});

export const BlogGenerator = () => {
  const [topic, setTopic] = useState('');
  const [blogPost, setBlogPost] = useState<BlogPost | null>(null);
  const [currentPostId, setCurrentPostId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [useTencentImages, setUseTencentImages] = useState(false);

  const resetState = () => {
    setBlogPost(null);
    setCurrentPostId(null);
    setIsLoadingSummary(false);
    setIsLoadingAudio(false);
  };

  const handleImageUpdated = async (sectionIndex: number, newImageUrl: string) => {
    console.log('Image updated at index:', sectionIndex, 'New URL length:', newImageUrl.length);
    
    // Immediately update the local state
    setBlogPost(prev => {
      if (!prev) return prev;
      
      const newSections = [...prev.sections];
      newSections[sectionIndex] = {
        ...newSections[sectionIndex],
        imageUrl: newImageUrl,
      };
      
      return {
        ...prev,
        sections: newSections,
      };
    });
    
    console.log('Local state updated, image should now show updated version');
  };

  const createEventHandlers = (currentTopic: string) => ({
    blogPost: (eventData: any, state: StreamState) => {
      state.partialBlogPost = eventData.data as BlogPost;
      if (state.partialBlogPost?.title && state.partialBlogPost?.sections) {
        setBlogPost(createBlogPostUpdate(state, { summary: undefined, audioUrl: undefined }));
        setIsLoadingSummary(true);
      }
    },

    summary: (eventData: any, state: StreamState) => {
      state.summary = eventData.data;
      setIsLoadingSummary(false);
      if (state.partialBlogPost) {
        setBlogPost(createBlogPostUpdate(state, { audioUrl: undefined }));
        setIsLoadingAudio(true);
      }
    },

    audioReady: (eventData: any, state: StreamState) => {
      state.audioReady = true;
      state.audioUrl = eventData.data.audioUrl;
    },

    collectImages: (eventData: any, state: StreamState) => {
      // Base64 images are too large to send via SSE
      // They will be saved to the database and loaded when the post is complete
      console.log('✅ Images processed and saved to database');
    },

    complete: async (eventData: any, state: StreamState) => {
      state.postId = eventData.data.id;
      state.threadId = eventData.data.threadId;
      const hasAudio = eventData.data.hasAudio;

      // Fetch the complete blog post from the database (includes images with base64 URLs)
      if (state.postId) {
        try {
          const postResponse = await fetch(`/api/blog/posts/${state.postId}`);
          if (postResponse.ok) {
            const { post } = await postResponse.json();
            
            // Update state with the complete blog post including images
            state.partialBlogPost = {
              title: post.title,
              sections: post.sections,
            };
            state.audioUrl = post.audioUrl;
            
            setBlogPost({
              id: post.id,
              title: post.title,
              sections: post.sections,
              summary: post.summary,
              audioUrl: post.audioUrl,
            });
            setCurrentPostId(state.postId);
            
            console.log('✅ Blog post loaded with images');
          }
        } catch (postError) {
          console.error('Failed to fetch complete blog post:', postError);
        }
      }

      setIsLoadingAudio(false);

      if (state.partialBlogPost) {
        const historyItem: GenerationHistory = {
          id: state.postId || crypto.randomUUID(),
          topic: currentTopic.trim(),
          blogPost: {
            title: state.partialBlogPost.title,
            sections: state.partialBlogPost.sections,
            summary: state.summary,
            audioUrl: state.audioUrl,
          },
          timestamp: new Date(),
          threadId: state.threadId,
        };
        setHistory(prev => [historyItem, ...prev]);
      }
      console.log('✅ Generation complete');
    },

    error: (eventData: any) => {
      throw new Error(eventData.data);
    },
  });

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await fetch('/api/blog/posts');
        if (!response.ok) throw new Error('Failed to load history');
        
        const data = await response.json();
        const posts = data.posts.map((post: {
          id: string;
          topic: string;
          title: string;
          sections: BlogPost['sections'];
          summary?: string;
          audioUrl?: string;
          createdAt: string;
          threadId: string;
        }) => ({
          id: post.id,
          topic: post.topic,
          blogPost: {
            id: post.id,
            title: post.title,
            sections: post.sections,
            summary: post.summary,
            audioUrl: post.audioUrl,
          },
          timestamp: new Date(post.createdAt),
          threadId: post.threadId,
        }));

        setHistory(posts);
      } catch (err) {
        console.error('Error loading history:', err);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadHistory();
  }, []);

  const handleGenerateBlog = async () => {
    if (!topic.trim()) return;
    
    setIsLoading(true);
    resetState();

    try {
      const newThreadId = crypto.randomUUID();

      const response = await fetch('/api/blog/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          topic: topic.trim(),
          threadId: newThreadId,
          imageGenerator: useTencentImages ? 'tencent' : 'gemini',
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate blog post: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('text/event-stream')) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No reader available');
        }

        const streamState: StreamState = {
          partialBlogPost: null,
          summary: undefined,
          audioUrl: undefined,
          postId: undefined,
          threadId: newThreadId,
          audioReady: false,
        };

        const eventHandlers = createEventHandlers(topic);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const eventData = JSON.parse(line.slice(6));
                const handler = eventHandlers[eventData.type as keyof typeof eventHandlers];

                if (handler) {
                  await handler(eventData, streamState);
                }
              } catch (parseError) {
                console.error('Error parsing SSE event:', parseError);
              }
            }
          }
        }

        setTopic('');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error('Error generating blog post:', err);
      setIsLoadingSummary(false);
      setIsLoadingAudio(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleGenerateBlog();
    }
  };

  const handleHistoryClick = (historyItem: GenerationHistory) => {
    setBlogPost(historyItem.blogPost);
  };

  const handleDeletePost = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this blog post?')) {
      return;
    }

    try {
      const response = await fetch(`/api/blog/posts/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete post');

      // Remove from history
      setHistory(prev => prev.filter(item => item.id !== id));
      
      // Clear display if this was the currently shown post
      if (blogPost && history.find(h => h.id === id)?.blogPost === blogPost) {
        setBlogPost(null);
      }
    } catch (err) {
      console.error('Error deleting post:', err);
      alert('Failed to delete post. Please try again.');
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Left Panel - Topic Input */}
      <div className="w-96 border-r border-border flex flex-col bg-secondary">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">AI Blog Generator</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Enter a topic to generate a structured blog post with text sections and images.
          </p>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="topic" className="block text-sm font-medium mb-2">
                Blog Topic
              </label>
              <Input
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="e.g., The Future of Artificial Intelligence"
                disabled={isLoading}
                className="w-full"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
              <div className="flex-1">
                <label htmlFor="image-generator" className="text-sm font-medium">
                  {useTencentImages ? 'Tencent HunyuanImage' : 'Gemini Flash'}
                </label>
              </div>
              <Switch
                id="image-generator"
                checked={useTencentImages}
                onCheckedChange={setUseTencentImages}
                disabled={isLoading}
                className="data-[state=checked]:bg-amber-400 data-[state=unchecked]:bg-blue-400"
              />
            </div>
            
            <Button 
              onClick={handleGenerateBlog}
              disabled={!topic.trim() || isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Blog Post'
              )}
            </Button>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Generation History */}
        <div className="flex-1 p-4">
          <h3 className="text-sm font-medium mb-3 text-muted-foreground">Generation History</h3>
          <ScrollArea className="h-full">
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No generations yet. Enter a topic to start!</p>
            ) : (
              <div className="space-y-2">
                {history.map((historyItem) => (
                  <div 
                    key={historyItem.id}
                    className="p-3 bg-background rounded border text-sm cursor-pointer hover:bg-accent transition-colors group relative"
                    onClick={() => handleHistoryClick(historyItem)}
                  >
                    <div className="font-medium truncate pr-8">{historyItem.topic}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {historyItem.timestamp.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground/60 mt-0.5 font-mono truncate">
                      Thread: {historyItem.threadId.slice(0, 8)}...
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => handleDeletePost(historyItem.id, e)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Right Panel - Blog Post Display */}
      <div className="flex-1 flex flex-col">
        {blogPost ? (
          <BlogPostDisplay 
            blogPost={blogPost} 
            isLoadingSummary={isLoadingSummary}
            isLoadingAudio={isLoadingAudio}
            onImageUpdated={handleImageUpdated}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Blog Post Generated</h2>
              <p className="text-muted-foreground">
                Enter a topic in the left panel and click &quot;Generate Blog Post&quot; to create your AI-powered blog post.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
