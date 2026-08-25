import type { RdbProvider } from "../db/rdb-provider";
import { createSkillServices } from "../skills/skill-service-factory";
import { createAgentExecutionService } from "../tasks/agent-execution-service-factory";
import { WorkflowSkillExecutionDeliveryService } from "./workflow-skill-execution-delivery-service";

export async function createWorkflowSkillExecutionDeliveryService(db: RdbProvider) {
  const skills = await createSkillServices(db);
  return new WorkflowSkillExecutionDeliveryService({ db, execution: createAgentExecutionService(db), preview: skills.preview });
}
