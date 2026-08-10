import type { RdbProvider } from "../db/rdb-provider";
import { ProjectRemoteAccessFactory } from "../git/remote-access-factory";
import { GitHubIntegrationProvider } from "../integrations/github";
import { GitHubCredentialResolver } from "../integrations/github-credential";
import { getSecretProvider } from "../secrets";
import { WorkspacePreparationService } from "./workspace-preparation-service";

export function createWorkspacePreparationService(db: RdbProvider): WorkspacePreparationService {
  const secrets = getSecretProvider(db);
  const githubCredentials = new GitHubCredentialResolver({
    db,
    ...(secrets ? { secrets } : {}),
  });
  return new WorkspacePreparationService({
    db,
    repositoryAccess: new ProjectRemoteAccessFactory({
      githubCredentials,
      githubProvider: (token) => new GitHubIntegrationProvider({ token }),
    }),
  });
}
