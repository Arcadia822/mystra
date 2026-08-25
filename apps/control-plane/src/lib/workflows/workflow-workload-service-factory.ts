import type { RdbProvider } from "../db/rdb-provider";
import { createAgentExecutionService } from "../tasks/agent-execution-service-factory";
import { ProgramOwnedFixedWorkflowRuntime } from "./fixed-workflow-runtime";
import { WorkflowSkillProjectionService } from "./workflow-skill-projection-service";
import { WorkflowWorkloadService } from "./workflow-workload-service";

export function createWorkflowWorkloadService(db: RdbProvider): WorkflowWorkloadService {
  const runtime = new ProgramOwnedFixedWorkflowRuntime();
  return new WorkflowWorkloadService({
    db,
    execution: createAgentExecutionService(db),
    runtime,
    skills: new WorkflowSkillProjectionService({ db, runtime }),
  });
}
