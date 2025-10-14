import { NextRequest } from "next/server";
import { createBlogGraph } from "@/lib/graph";
import { dbManager } from "@/lib/database";
import { BlogPost } from "@/lib/nodes/blog-content.node";
import { BlogGenerationStateType } from "@/lib/node-state";

export const runtime = "nodejs";

type NodeState = {
  blogPost: BlogPost | undefined;
  sections: BlogPost["sections"] | undefined;
  summary: string | undefined;
  audioUrl: string | undefined;
};

type NodeHandler = {
  extractData: (nodeOutput: Partial<BlogGenerationStateType>) => unknown;
  updateState: (state: NodeState, data: unknown) => void;
  streamEvent?: (data: unknown) => { type: string; data: unknown };
};

const createStreamData = (payload: { type: string; data: unknown }): string => {
  return `data: ${JSON.stringify(payload)}\n\n`;
};

const nodeHandlers: Record<string, NodeHandler> = {
  generateBlog: {
    extractData: (nodeOutput) => nodeOutput.blogPost,
    updateState: (state, data) => {
      state.blogPost = data as BlogPost;
    },
    streamEvent: (data) => ({ type: "blogPost", data }),
  },
  summarizeBlog: {
    extractData: (nodeOutput) => nodeOutput.summary,
    updateState: (state, data) => {
      state.summary = data as string;
    },
    streamEvent: (data) => ({ type: "summary", data }),
  },
  generateAudio: {
    extractData: (nodeOutput) => nodeOutput.audioUrl,
    updateState: (state, data) => {
      state.audioUrl = data as string;
    },
    streamEvent: () => ({ type: "audioReady", data: true }),
  },
  collectImages: {
    extractData: (nodeOutput) => nodeOutput.blogPost?.sections,
    updateState: (state, data) => {
      state.sections = data as BlogPost["sections"];
    },
    // Don't send base64 image data through SSE - it's too large
    // Just send a signal that images are ready
    streamEvent: () => ({ type: "collectImages", data: { ready: true } }),
  },
};

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const { topic, threadId, imageGenerator = 'gemini' } = await req.json();

    const currentThreadId = threadId || crypto.randomUUID();
    const graph = await createBlogGraph(imageGenerator);

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const state: NodeState = {
            blogPost: undefined,
            sections: undefined,
            summary: undefined,
            audioUrl: undefined,
          };

          for await (const event of await graph.stream(
            { topic },
            {
              configurable: { thread_id: currentThreadId },
              streamMode: "updates",
            }
          )) {
            const entries = Object.entries(event);

            for (const [nodeName, nodeOutput] of entries) {
              const handler = nodeHandlers[nodeName];

              if (handler) {
                const data = handler.extractData(
                  nodeOutput as Partial<BlogGenerationStateType>
                );
                handler.updateState(state, data);

                if (handler.streamEvent) {
                  const streamData = createStreamData(handler.streamEvent(data));
                  controller.enqueue(encoder.encode(streamData));
                }
              }
            }
          }

          if (state.blogPost) {
            const { id } = await dbManager.createBlogPost({
              threadId: currentThreadId,
              topic,
              title: state.blogPost.title,
              sections: state.sections || state.blogPost.sections,
              summary: state.summary,
              audioUrl: state.audioUrl,
            });

            const completeData = createStreamData({
              type: "complete",
              data: {
                id,
                threadId: currentThreadId,
                hasAudio: !!state.audioUrl,
                hasSummary: !!state.summary,
              },
            });
            controller.enqueue(encoder.encode(completeData));
          }

          controller.close();
        } catch (error) {
          console.error("Error in stream:", error);
          const errorData = `data: ${JSON.stringify({
            type: "error",
            data: error instanceof Error ? error.message : "Unknown error",
          })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("Error in blog generation API:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
