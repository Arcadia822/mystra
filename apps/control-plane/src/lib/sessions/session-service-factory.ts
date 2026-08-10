import type { RdbProvider } from "../db/rdb-provider";
import { withDerivedHostLiveness } from "../runtime/runtime-liveness";
import { createTaskWorkspaceService } from "../task-workspaces/task-workspace-service-factory";
import { SessionService } from "./session-service";

export function createSessionService(db: RdbProvider): SessionService {
  return new SessionService({
    db,
    workspace: createTaskWorkspaceService(db),
    runtimeResolver: async (id) => {
      const runtime = await db.getRuntime(id);
      return runtime ? withDerivedHostLiveness(runtime) : undefined;
    },
  });
}
