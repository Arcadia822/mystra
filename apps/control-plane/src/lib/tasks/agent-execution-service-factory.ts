import type { RdbProvider } from "../db/rdb-provider";
import { AgentExecutionService } from "./agent-execution-service";

export function createAgentExecutionService(db: RdbProvider): AgentExecutionService {
  return new AgentExecutionService({ db });
}
