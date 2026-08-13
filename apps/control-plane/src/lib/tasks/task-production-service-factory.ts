import type { RdbProvider } from "../db/rdb-provider";
import { createSessionService } from "../sessions/session-service-factory";
import { createTaskWorkspaceService } from "../task-workspaces/task-workspace-service-factory";
import { TaskProductionService } from "./task-production-service";

export function createTaskProductionService(db: RdbProvider): TaskProductionService {
  return new TaskProductionService({
    db,
    workspace: createTaskWorkspaceService(db),
    sessions: createSessionService(db),
  });
}
