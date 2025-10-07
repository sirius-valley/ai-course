import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";

export class DatabaseManager {
  private checkpointer: SqliteSaver;

  constructor() {
    this.checkpointer = SqliteSaver.fromConnString("./database.db");
  }

  async initialize(): Promise<void> {
    console.log("Database initialized (in-memory SQLite)");
  }

  getCheckpointer(): SqliteSaver {
    return this.checkpointer;
  }

  async close(): Promise<void> {
    console.log("Database connection will be cleaned up on process exit");
  }
}

export const dbManager = new DatabaseManager();
