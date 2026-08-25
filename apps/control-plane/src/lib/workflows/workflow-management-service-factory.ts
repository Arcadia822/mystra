import type { RdbProvider } from "../db/rdb-provider";
import { WorkflowManagementService } from "./workflow-management-service";

export function createWorkflowManagementService(db: RdbProvider): WorkflowManagementService {
  return new WorkflowManagementService({ db });
}
