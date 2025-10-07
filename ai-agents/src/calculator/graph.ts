import { chatbotNode, toolsNode } from "./nodes.js";
import { createGenericGraph } from "../generic-graph.js";

export const createGraph = async () => {
  return await createGenericGraph(
    "calculator-agent",
    chatbotNode,
    toolsNode,
  );
};
