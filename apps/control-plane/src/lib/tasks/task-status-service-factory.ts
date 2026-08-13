import type { RdbProvider } from "../db/rdb-provider";
import { TaskStatusService } from "./task-status-service";

export function createTaskStatusService(db: RdbProvider): TaskStatusService {
  return new TaskStatusService({ db });
}
