import type { RdbProvider } from "../db/rdb-provider";
import { withDerivedHostLiveness } from "../runtime/runtime-liveness";
import { createTaskWorkspaceService } from "../task-workspaces/task-workspace-service-factory";
import { SessionService } from "./session-service";
import { ProgramOwnedFixedWorkflowRuntime } from "../workflows/fixed-workflow-runtime";
import { WorkflowSkillProjectionService } from "../workflows/workflow-skill-projection-service";
import { WorkflowSessionLaunchService } from "../workflows/workflow-session-launch-service";

export function createSessionService(db: RdbProvider): SessionService {
  const workflowRuntime = new ProgramOwnedFixedWorkflowRuntime();
  return new SessionService({
    db,
    workspace: createTaskWorkspaceService(db),
    runtimeResolver: async (id) => {
      const runtime = await db.getRuntime(id);
      return runtime ? withDerivedHostLiveness(runtime) : undefined;
    },
    workflow: new WorkflowSessionLaunchService({
      db,
      runtime: workflowRuntime,
      skills: new WorkflowSkillProjectionService({ db, runtime: workflowRuntime }),
    }),
  });
}
