import z, { nullable } from "zod";
import { BlogGenerationStateType } from "../node-state";
import { ChatOpenAI } from "@langchain/openai";
import { TavilySearch } from "@langchain/tavily";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

export interface BlogPost {
  id?: string;
  title: string;
  sections: BlogSection[];
  summary?: string;
  audioUrl?: string;
}

export interface BlogSection {
  type: 'text' | 'image';
  content: string;
  imageUrl?: string;
  imageAlt?: string;
}

const BlogSectionSchema = z.object({
  type: z.enum(["text", "image"]),
  content: z.string().describe("The main content or caption. For text sections use plain text, not markdown"),
  imageUrl: z.string().nullable().optional().describe("URL of the image (null for placeholders)"),
  imageAlt: z.string().nullable().optional().describe("Alt text for the image"),
});

export const BlogPostSchema = z.object({
  title: z.string().describe("An engaging, SEO-friendly title for the blog post"),
  sections: z.array(BlogSectionSchema).min(3).max(10).describe("Array of text and image sections"),
});

export const createBlogNode = async (state: BlogGenerationStateType): Promise<Partial<BlogGenerationStateType>> => {
  try {
    // Initialize Tavily search tool
    const tavilyTool = new TavilySearch();

    const llm = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0.7,
    });

    const systemPrompt = `
      You are an expert blog post generator. Create a comprehensive, engaging blog post about the given topic.
      You have access to a web search tool to find current, accurate information.

      Guidelines:
      - First, use the tavily_search tool to research the topic and gather accurate, up-to-date information
      - Use the search results to inform your content
      - Create an engaging, SEO-friendly title
      - Include 3-5 sections mixing text and image placeholders
      - For text sections: Write rich, informative content with proper paragraphs based on your research
      - For image sections: Provide descriptive captions and alt text, but set imageUrl to null (NOT an empty string)
      - Structure: Introduction → Body (with images) → Conclusion
      - Make content valuable and well-researched
      - IMPORTANT: For image sections, imageUrl MUST be null (not undefined, not empty string, but explicitly null)
      
      After researching, provide the complete blog post content that will be structured.
    `;

    // Step 1: Create React Agent with Tavily tool (text-based responses for tool use)
    const agent = createReactAgent({
      llm,
      tools: [tavilyTool],
    });

    const userPrompt = `Create a blog post about: ${state.topic}`;

    // Agent automatically researches using Tavily and generates content
    const agentResult = await agent.invoke({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
    });

    // Extract the researched content from agent
    const messages = agentResult.messages;
    const lastMessage = messages[messages.length - 1];
    const researchedContent = lastMessage.content as string;

    // Step 2: Convert researched content to structured blog post
    const structuredLlm = llm.withStructuredOutput(BlogPostSchema, {
      name: "blog_post_generator",
    });

    const blogPost = await structuredLlm.invoke([
      { role: "system", content: "Convert the following blog content into the structured format." },
      { role: "user", content: researchedContent },
    ]) as BlogPost;
    
    return { blogPost };
  } catch (error) {
    console.error("Error in blog generation node:", error);
    return { 
      error: error instanceof Error ? error.message : "Failed to generate blog post" 
    };
  }
};

export const summarizeBlogNode = async (state: BlogGenerationStateType): Promise<Partial<BlogGenerationStateType>> => {
  try {
    if (!state.blogPost) {
      return { error: "No blog post to summarize" };
    }

    const llm = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0.5,
    });

    const fullText = state.blogPost.sections
      .filter(section => section.type === 'text')
      .map(section => section.content)
      .join('\n\n');

    const systemPrompt = `You are an expert at creating concise, engaging summaries. 
      Create a 2-3 sentence summary that captures the key points and main message of the blog post.
      The summary should be perfect for audio narration - clear, flowing, and engaging.
    `;

    const userPrompt = `Summarize this blog post titled "${state.blogPost.title}":\n\n${fullText}`;

    const response = await llm.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]);

    const summary = response.content as string;
    
    return { summary };
  } catch (error) {
    console.error("Error in summarization node:", error);
    return { 
      error: error instanceof Error ? error.message : "Failed to summarize blog post" 
    };
  }
};