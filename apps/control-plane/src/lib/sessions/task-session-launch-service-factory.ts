import type { RdbProvider } from "../db/rdb-provider";
import { createTaskWorkspaceService } from "../task-workspaces/task-workspace-service-factory";
import { TaskProductionService } from "../tasks/task-production-service";
import { createSessionService } from "./session-service-factory";
import { TaskSessionLaunchService } from "./task-session-launch-service";

export function createTaskSessionLaunchService(db: RdbProvider): TaskSessionLaunchService {
  const workspace = createTaskWorkspaceService(db);
  const sessions = createSessionService(db);
  const production = new TaskProductionService({ db, workspace, sessions });
  return new TaskSessionLaunchService({ db, workspace, sessions, production });
}
