import type { RdbProvider } from "../db/rdb-provider";
import { createSkillServices } from "../skills/skill-service-factory";
import { WorkflowSkillDeliveryService } from "./workflow-skill-delivery-service";

export async function createWorkflowSkillDeliveryService(db: RdbProvider) {
  const skills = await createSkillServices(db);
  return new WorkflowSkillDeliveryService({ db, preview: skills.preview });
}
