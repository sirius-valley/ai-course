"use client";

import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Copy, Download, Image as ImageIcon, Play, Pause, Volume2, Loader2, RefreshCw } from 'lucide-react';
import { useState, useRef } from 'react';
import { BlogPost } from '@/lib/nodes/blog-content.node';

interface BlogPostDisplayProps {
  blogPost: BlogPost & { id?: string };
  isLoadingSummary?: boolean;
  isLoadingAudio?: boolean;
  onImageUpdated?: (sectionIndex: number, newImageUrl: string) => void;
}

export const BlogPostDisplay = ({ 
  blogPost, 
  isLoadingSummary = false,
  isLoadingAudio = false,
  onImageUpdated,
}: BlogPostDisplayProps) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [editingImageIndex, setEditingImageIndex] = useState<number | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [imageVersions, setImageVersions] = useState<Record<number, number>>({});
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleCopyContent = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy content:', err);
    }
  };

  const handleCopyFullPost = async () => {
    const fullContent = `# ${blogPost.title}\n\n${blogPost.sections
      .filter(section => section.type === 'text')
      .map(section => section.content)
      .join('\n\n')}`;
    
    try {
      await navigator.clipboard.writeText(fullContent);
      setCopiedIndex(-1);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy full post:', err);
    }
  };

  const handleDownloadPost = () => {
    const fullContent = `# ${blogPost.title}\n\n${blogPost.sections
      .map(section => {
        if (section.type === 'text') {
          return section.content;
        } else if (section.type === 'image') {
          return `![${section.imageAlt || 'Image'}](${section.imageUrl || 'placeholder.jpg'})\n\n*${section.content}*`;
        }
        return '';
      })
      .join('\n\n')}`;

    const blob = new Blob([fullContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${blogPost.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleAudioPlayback = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const handleEditImage = async () => {
    if (!blogPost.id) {
      alert("Cannot edit image: Blog post ID is missing. Please save the blog post first.");
      return;
    }
    
    if (editingImageIndex === null || !editPrompt.trim()) {
      return;
    }

    setIsEditingImage(true);
    
    try {
      const response = await fetch(`/api/blog/posts/${blogPost.id}/edit-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sectionIndex: editingImageIndex,
          prompt: editPrompt.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to edit image");
      }

      const result = await response.json();
      console.log('Image edit successful:', result);

      // Increment version for this image to force re-render
      setImageVersions(prev => ({
        ...prev,
        [editingImageIndex]: (prev[editingImageIndex] || 0) + 1
      }));

      // Reset state
      setEditPrompt("");
      const updatedIndex = editingImageIndex;
      setEditingImageIndex(null);
      
      // Trigger refresh with new image URL
      console.log('Calling onImageUpdated callback with new image URL');
      if (onImageUpdated) {
        await onImageUpdated(updatedIndex, result.imageUrl);
      }
      console.log('Image refresh complete for index:', updatedIndex);
    } catch (error) {
      console.error("Error editing image:", error);
      alert(error instanceof Error ? error.message : "Failed to edit image");
    } finally {
      setIsEditingImage(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-border bg-background">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold mb-2">{blogPost.title}</h1>
            <p className="text-sm text-muted-foreground">
              {blogPost.sections.length} sections • {
                blogPost.sections.filter(s => s.type === 'text').length
              } text blocks • {
                blogPost.sections.filter(s => s.type === 'image').length
              } images
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyFullPost}
              className="flex items-center gap-2"
            >
              <Copy className="h-4 w-4" />
              {copiedIndex === -1 ? 'Copied!' : 'Copy All'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPost}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-4xl mx-auto">
          {/* Summary Section - Show skeleton or content */}
          {(blogPost.summary || isLoadingSummary) && (
            <div className="mb-8 p-6 bg-accent/30 border border-border rounded-lg">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <Volume2 className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Summary</h3>
                  </div>
                  {isLoadingSummary ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ) : (
                    <p className="text-base leading-relaxed text-foreground/90">
                      {blogPost.summary}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-center gap-2">
                  {isLoadingAudio ? (
                    <Button
                      variant="default"
                      size="lg"
                      disabled
                      className="flex items-center gap-2"
                    >
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Generating
                    </Button>
                  ) : blogPost.audioUrl ? (
                    <>
                      <Button
                        variant="default"
                        size="lg"
                        onClick={toggleAudioPlayback}
                        className="flex items-center gap-2"
                      >
                        {isPlaying ? (
                          <>
                            <Pause className="h-5 w-5" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="h-5 w-5" />
                            Play
                          </>
                        )}
                      </Button>
                      <audio 
                        ref={audioRef}
                        src={blogPost.audioUrl}
                        onEnded={handleAudioEnded}
                        className="hidden"
                      />
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-8">
            {blogPost.sections.map((section, index) => (
              <div key={index} className="group relative">
                {section.type === 'text' ? (
                  <div className="prose prose-neutral dark:prose-invert max-w-none">
                    <div 
                      className="whitespace-pre-wrap text-base leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: section.content.replace(/\n/g, '<br>') }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyContent(section.content, index)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Copy className="h-4 w-4" />
                      {copiedIndex === index ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative group">
                      {section.imageUrl && section.imageUrl.trim() !== '' ? (
                        <div className="border border-border rounded-lg overflow-hidden bg-secondary/50 relative">
                          {isEditingImage && editingImageIndex === index && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
                              <Loader2 className="h-8 w-8 animate-spin text-white" />
                            </div>
                          )}
                          <img
                            key={`image-${index}-v${imageVersions[index] || 0}`}
                            src={section.imageUrl}
                            alt={section.imageAlt || 'Blog post image'}
                            className="w-full object-cover"
                          />
                        </div>
                      ) : (
                        <Skeleton className="w-full h-64 rounded-lg bg-gray-300" />
                      )}
                      
                      {blogPost.id && section.imageUrl && (
                        <Dialog open={editingImageIndex === index} onOpenChange={(open) => {
                          if (!open) {
                            setEditingImageIndex(null);
                            setEditPrompt("");
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setEditingImageIndex(index)}
                              className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                              disabled={isEditingImage}
                            >
                              <RefreshCw className={`h-4 w-4 mr-1 ${isEditingImage && editingImageIndex === index ? 'animate-spin' : ''}`} />
                              Edit Image
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Image</DialogTitle>
                              <DialogDescription>
                                Describe how you want to modify this image. Be specific about the changes you want to make.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <label htmlFor="edit-prompt" className="text-sm font-medium">
                                  Edit Prompt
                                </label>
                                <Input
                                  id="edit-prompt"
                                  placeholder="e.g., Make the background darker, add more contrast..."
                                  value={editPrompt}
                                  onChange={(e) => setEditPrompt(e.target.value)}
                                  className="mt-1"
                                  disabled={isEditingImage}
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setEditingImageIndex(null);
                                  setEditPrompt("");
                                }}
                                disabled={isEditingImage}
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={handleEditImage}
                                disabled={!editPrompt.trim() || isEditingImage}
                              >
                                {isEditingImage ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Editing...
                                  </>
                                ) : (
                                  'Apply Changes'
                                )}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                    {section.content && (
                      <p className="text-sm text-muted-foreground italic flex items-start gap-2">
                        <ImageIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>{section.content}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
