import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { dbManager } from "./database.js";
import { AIMessage, BaseMessage } from "@langchain/core/messages.js";

const shouldContinue = (state: AgentStateType): string => {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1] as AIMessage;

  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return "tools";
  }

  return "__end__";
};

export const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
});

export type AgentStateType = typeof AgentState.State;

export const createGenericGraph = async (
  agentName: string, 
  chatbotNode: (state: AgentStateType) => Promise<Partial<AgentStateType>>, 
  toolsNode: (state: AgentStateType) => Promise<Partial<AgentStateType>>
) => {
  await dbManager.initialize();
 
  const workflow = new StateGraph(AgentState)
    .addNode(agentName, chatbotNode)
    .addNode("tools", toolsNode)
    .addEdge(START, agentName)
    .addConditionalEdges(agentName, shouldContinue)
    .addEdge("tools", agentName);

  const graph = workflow.compile({
    checkpointer: dbManager.getCheckpointer(),
  });

  return graph;
};
