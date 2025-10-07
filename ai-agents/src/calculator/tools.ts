import { InferInteropZodOutput } from "@langchain/core/dist/utils/types";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const SumSchema = z.object({
  a: z.number().describe("The first number to sum."),
  b: z.number().describe("The second number to sum."),
});

export const sumTool = tool(
  async (input) => {
    const { a, b } = input as InferInteropZodOutput<typeof SumSchema>;
    return `${a + b}`;
  },
  {
    name: "sum",
    description: "Call to sum two numbers.",
    schema: SumSchema,
  }
);

const SubtractSchema = z.object({
  a: z.number().describe("The first number to subtract."),
  b: z.number().describe("The second number to subtract."),
});

export const subtractTool = tool(
  async (input) => {
    const { a, b } = input as InferInteropZodOutput<typeof SubtractSchema>;
    return `${a - b}`;
  },
  {
    name: "subtract",
    description: "Call to subtract two numbers.",
    schema: SubtractSchema,
  }
);

const MultiplySchema = z.object({
  a: z.number().describe("The first number to multiply."),
  b: z.number().describe("The second number to multiply."),
});

export const multiplyTool = tool(
  async (input) => {
    const { a, b } = input as InferInteropZodOutput<typeof MultiplySchema>;
    return `${a * b}`;
  },
  {
    name: "multiply",
    description: "Call to multiply two numbers.",
    schema: MultiplySchema,
  }
);

const DivideSchema = z.object({
  a: z.number().describe("The nominator"),
  b: z.number().describe("The denominator"),
});

export const divideTool = tool(
  async (input) => {
    const { a, b } = input as InferInteropZodOutput<typeof DivideSchema>;
    return `${a / b}`;
  },
  {
    name: "divide",
    description: "Call to divide two numbers.",
    schema: DivideSchema,
  }
);

export const tools = [sumTool, subtractTool, multiplyTool, divideTool];
