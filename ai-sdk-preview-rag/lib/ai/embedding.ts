import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";
import { cosineDistance, desc, gt, sql } from "drizzle-orm";
import { embeddings } from "../db/schema/embeddings";
import { db } from "../db";

const embeddingModel = openai.embedding("text-embedding-ada-002");

const generateChunks = (
  input: string,
  options?: { wordsPerChunk?: number; overlapWords?: number },
): string[] => {
  const wordsPerChunk = options?.wordsPerChunk ?? 200;
  const overlapWords = options?.overlapWords ?? 40;

  const normalized = input.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) return [];

  const words = normalized.split(" ");
  if (wordsPerChunk <= 0) return [];

  const step = Math.max(1, wordsPerChunk - Math.max(0, overlapWords));
  const chunks: string[] = [];

  for (let start = 0; start < words.length; start += step) {
    const end = Math.min(words.length, start + wordsPerChunk);
    const chunk = words.slice(start, end).join(" ").trim();
    if (chunk.length > 0) chunks.push(chunk);
    if (end === words.length) break;
  }

  return chunks;
};

export const generateEmbeddings = async (
  value: string,
  options?: { wordsPerChunk?: number; overlapWords?: number; batchSize?: number },
): Promise<Array<{ embedding: number[]; content: string }>> => {
  const chunks = generateChunks(value, {
    wordsPerChunk: options?.wordsPerChunk,
    overlapWords: options?.overlapWords,
  });

  const batchSize = options?.batchSize ?? 100;
  const results: Array<{ embedding: number[]; content: string }> = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const slice = chunks.slice(i, i + batchSize);
    const { embeddings: batchEmbeddings } = await embedMany({
      model: embeddingModel,
      values: slice,
    });
    for (let j = 0; j < batchEmbeddings.length; j++) {
      results.push({ content: slice[j], embedding: batchEmbeddings[j] });
    }
  }

  return results;
};

export const generateEmbedding = async (value: string): Promise<number[]> => {
  const input = value.replaceAll("\n", " ");
  const { embedding } = await embed({
    model: embeddingModel,
    value: input,
  });
  return embedding;
};

export const findRelevantContent = async (userQuery: string) => {
  const userQueryEmbedded = await generateEmbedding(userQuery);
  const similarity = sql<number>`1 - (${cosineDistance(embeddings.embedding, userQueryEmbedded)})`;
  const similarGuides = await db
    .select({ id: embeddings.id, content: embeddings.content, similarity })
    .from(embeddings)
    .where(gt(similarity, 0.3))
    .orderBy((t) => desc(t.similarity))
    .limit(10);
  return similarGuides;
};
