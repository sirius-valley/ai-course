import { StateGraph, START, END, Send } from "@langchain/langgraph";
import { dbManager } from "./database";
import { BlogGenerationState, BlogGenerationStateType } from "./node-state";
import { createBlogNode, summarizeBlogNode } from "./nodes/blog-content.node";
import { collectImagesNode, googleImageGenerationNode, tencentImageGenerationNode } from "./nodes/image.node";
import { generateAudioNode } from "./nodes/audio.node";

const routeAfterBlogGeneration = (state: BlogGenerationStateType): Send[] => {
  const sends: Send[] = [];
  
  if (state.blogPost) {
    const imageSections = state.blogPost.sections
      .map((section, index) => ({ section, index }))
      .filter(({ section }) => section.type === 'image');

    if (imageSections.length > 0) {
      console.log(`\nSpawning ${imageSections.length} parallel branches:`);
      
      imageSections.forEach(({ section, index }) => {
        sends.push(new Send("generateSingleImage", {
          ...state,
          sectionIndex: index,
          imageCaption: section.content,
        }));
      });
    } else {
      console.log("\nNo images to generate - only running summarize branch\n");
    }
  }
  
  return sends;
};

export const createBlogGraph = async (imageGenerator: 'gemini' | 'tencent' = 'gemini') => {
  await dbManager.initialize();

  // Select the image generation node based on the generator type
  const imageGeneratorNode = imageGenerator === 'tencent' 
    ? tencentImageGenerationNode 
    : googleImageGenerationNode;

  const workflow = new StateGraph(BlogGenerationState)
    .addNode("generateBlog", createBlogNode)
    .addNode("summarizeBlog", summarizeBlogNode)
    .addNode("generateAudio", generateAudioNode)
    .addNode("generateSingleImage", imageGeneratorNode)
    .addNode("collectImages", collectImagesNode)

    .addEdge(START, "generateBlog")

    // Spawn parallel branches: summarize+audio AND image generation
    .addEdge("generateBlog", "summarizeBlog")
    .addConditionalEdges(
      "generateBlog", 
      routeAfterBlogGeneration,
      ["generateSingleImage"]
    )

    // Branch 1: summarize → audio → END
    .addEdge("summarizeBlog", "generateAudio")
    .addEdge("generateAudio", END)

    // Branch 2: images → collect → END
    .addEdge("generateSingleImage", "collectImages")
    .addEdge("collectImages", END);

  return workflow.compile({
    checkpointer: dbManager.getCheckpointer(),
  });
};
