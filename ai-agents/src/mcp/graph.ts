import { chatbotNode, toolsNode } from "./nodes.js";
import { createGenericGraph } from "../generic-graph.js";

export const createGraph = async () => {
  return await createGenericGraph(
    "vacations-agent",
    chatbotNode,
    toolsNode
  );
};