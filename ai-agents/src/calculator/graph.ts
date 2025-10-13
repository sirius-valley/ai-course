import "dotenv/config";
import { chatbotNode, toolsNode } from "./nodes.js";
import { createGenericGraph } from "../generic-graph.js";
import { HumanMessage } from "@langchain/core/messages";

export const createGraph = async () => {
  return await createGenericGraph(
    "calculator-agent",
    chatbotNode,
    toolsNode
  );
};

const main = async () => {
  try {
    const graph = await createGraph();
    
    const result = await graph.invoke({ 
      messages: [
        new HumanMessage("Add 3 and 4. Multiply the output by 2. Divide the output by 5")
      ] 
    }, {
      configurable: { thread_id: "calculator-1" }
    });

    console.log("Result:", result.messages[result.messages.length - 1].content);
  } catch (error) {
    console.error("❌ Error running calculator agent:", error);
    process.exit(1);
  }
};

// Only run if this file is executed directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}
