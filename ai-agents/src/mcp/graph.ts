import "dotenv/config";
import { chatbotNode, toolsNode } from "./nodes.js";
import { createGenericGraph } from "../generic-graph.js";
import { HumanMessage } from "@langchain/core/messages";

export const createGraph = async () => {
  return await createGenericGraph(
    "vacations-agent",
    chatbotNode,
    toolsNode
  );
};

const main = async () => {
  try {
    const graph = await createGraph();
    
    const result = await graph.invoke({ 
      messages: [
        new HumanMessage("I want to travel between Florence and Naples. I want to start the 10th of October and finish on the 20th of October.")
      ] 
    }, {
      configurable: { thread_id: "1" }
    });

    console.log("Result:", result.messages[result.messages.length - 1].content);
  } catch (error) {
    console.error("❌ Error running vacation planning agent:", error);
    process.exit(1);
  }
};

// Only run if this file is executed directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}
