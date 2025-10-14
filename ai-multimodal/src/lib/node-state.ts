import { Annotation } from "@langchain/langgraph";
import { BlogPost } from "./nodes/blog-content.node";

export const BlogGenerationState = Annotation.Root({
  topic: Annotation<string>,
  blogPost: Annotation<BlogPost | undefined>,
  summary: Annotation<string | undefined>,
  audioUrl: Annotation<string | undefined>,
  error: Annotation<string | undefined>,
  generatedImages: Annotation<Array<{ sectionIndex: number; imageUrl: string }>>({
    reducer: (current, update) => [...(current || []), ...(update || [])],
  }),
});

export type BlogGenerationStateType = typeof BlogGenerationState.State;

export const ImageGenerationState = Annotation.Root({
  ...BlogGenerationState.spec,
  sectionIndex: Annotation<number>,
  imageCaption: Annotation<string>,
});

export type ImageGenerationStateType = typeof ImageGenerationState.State;