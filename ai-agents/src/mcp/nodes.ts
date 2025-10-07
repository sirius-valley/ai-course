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
}).bindTools(tools); // Allow for parallel tool calls (parallel place research)

export const chatbotNode = async (
  state: AgentStateType
): Promise<Partial<AgentStateType>> => {
  const { messages } = state;

  const systemMessage = new SystemMessage(
    `You are a helpful assistant tasked with building detailed trip itineraries for users.
    Given two locations and a date range you will use the provided tools to build a detailed trip itinerary.
    Build a route between the two locations using "maps_directions" tool and then suggest locations to stay along the way.
    Suggest locations to stay along the way between the two locations. Suggest staying the most days at the most popular locations, fewer at the less popular ones.
    Fill every single day between the check-in and check-out dates with the best accomodations, activities and routes.
    Always provide the following information in your response:
    - The list of suggested places to visit (provide the suggested duration of stay at each place)
    - The Airbnb accomation to stay at each place (provide the suggested duration of stay at each place). By default use 2 adults as the number of guests.
    - The list of suggested activities to do at each place ("maps_search_places" tool, look for activities in the area)
    - The list of suggested routes to travel between each place (provide distance, time and rough route summary)

    Use "airbnb_search" tool to find the best accomodations to stay at each place. Call once per place.

    First build a rough itinerary with the locations and dates, then build the route, activities and accomodations details.
    `
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