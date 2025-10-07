import {
  AIMessage,
  SystemMessage,
  BaseMessage,
} from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { AgentStateType } from "../generic-graph.js";
import { tools } from "./tools.js";

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 1,
}).bindTools(tools, { parallel_tool_calls: false }); // Avoid parallel calculations

export const chatbotNode = async (
  state: AgentStateType
): Promise<Partial<AgentStateType>> => {
  const { messages } = state;

  const systemMessage = new SystemMessage(
    `You are a helpful assistant tasked with performing arithmetic on a set of inputs.`
  );

  const messagesWithSystem = [systemMessage, ...messages];
  const response = await model.invoke(messagesWithSystem);

  return { messages: [response] };
};

export const toolsNode = async (
  state: AgentStateType
): Promise<Partial<AgentStateType>> => {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1] as AIMessage;

  if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
    return {};
  }

  const toolMessages: BaseMessage[] = [];

  for (const toolCall of lastMessage.tool_calls) {
    const tool = tools.find((t) => t.name === toolCall.name);
    if (tool) {
      try {
        const result = await tool.invoke(toolCall.args);
        toolMessages.push({
          tool_call_id: toolCall.id ?? "",
          type: "tool" as const,
          content: result,
          name: toolCall.name,
        } as unknown as BaseMessage);
      } catch (error) {
        toolMessages.push({
          tool_call_id: toolCall.id ?? "",
          type: "tool" as const,
          content: `Error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          name: toolCall.name,
        } as unknown as BaseMessage);
      }
    }
  }

  return { messages: toolMessages };
};
