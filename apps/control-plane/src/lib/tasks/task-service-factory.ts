import type { RdbProvider } from "../db/rdb-provider";
import { defaultGitHubCredentialResolver } from "../integrations/github-credential";
import { ProjectIssuesService } from "../integrations/project-issues";
import { getSecretProvider } from "../secrets";
import { TaskService } from "./task-service";

export async function createTaskService(db: RdbProvider): Promise<TaskService> {
  const secrets = getSecretProvider(db);
  return new TaskService({
    db,
    issues: new ProjectIssuesService({
      db,
      githubCredentials: await defaultGitHubCredentialResolver(),
      ...(secrets ? { secrets } : {}),
    }),
  });
}
