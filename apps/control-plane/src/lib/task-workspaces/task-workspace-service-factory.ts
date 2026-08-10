import type {
  TaskIssueReference,
  WorkspaceBranchDecision,
} from "@mystra/shared";

import type { IntegrationConnectionRecord, RdbProvider } from "../db/rdb-provider";
import { ProjectRemoteAccessFactory } from "../git/remote-access-factory";
import { RemoteRepositoryReader } from "../git/remote-repository-reader";
import { GitHubIntegrationProvider } from "../integrations/github";
import { GitHubCredentialResolver } from "../integrations/github-credential";
import { LinearIssueProvider } from "../integrations/linear";
import { getSecretProvider } from "../secrets";
import { withDerivedHostLiveness } from "../runtime/runtime-liveness";
import type { SecretProvider } from "../secrets/secret-provider";
import { TaskWorkspaceService } from "./task-workspace-service";

type IssueConnectionDb = Pick<RdbProvider, "getIntegrationConnectionRecord">;

export class ExactIssueWorkspaceBranches {
  readonly #db: IssueConnectionDb;
  readonly #githubCredentials: Pick<GitHubCredentialResolver, "resolve">;
  readonly #secrets: SecretProvider | undefined;

  constructor(input: {
    db: IssueConnectionDb;
    githubCredentials: Pick<GitHubCredentialResolver, "resolve">;
    secrets?: SecretProvider;
  }) {
    this.#db = input.db;
    this.#githubCredentials = input.githubCredentials;
    this.#secrets = input.secrets;
  }

  async resolve(
    issue: TaskIssueReference,
    taskId: string,
    teamId: string,
  ): Promise<WorkspaceBranchDecision> {
    const connection = await this.#requireConnection(issue, teamId);
    if (issue.provider === "github") {
      const resolved = await this.#githubCredentials.resolve(issue.connectionId);
      if (resolved.connection.id !== connection.id || resolved.connection.teamId !== teamId) {
        throw new Error("Exact GitHub Issue connection mismatch");
      }
      return new GitHubIntegrationProvider({ token: resolved.credential.secret })
        .resolveWorkspaceBranch({ issue, taskId });
    }
    if (!connection.credentialRef || !this.#secrets) {
      throw new Error("Exact Linear Issue credential is unavailable");
    }
    const apiKey = await this.#secrets.get(connection.credentialRef);
    return new LinearIssueProvider({ apiKey }).resolveWorkspaceBranch({ issue, taskId });
  }

  async #requireConnection(
    issue: TaskIssueReference,
    teamId: string,
  ): Promise<IntegrationConnectionRecord> {
    const connection = await this.#db.getIntegrationConnectionRecord(issue.connectionId);
    if (
      !connection
      || connection.id !== issue.connectionId
      || connection.teamId !== teamId
      || connection.integration !== issue.provider
      || connection.provider !== issue.provider
      || connection.status !== "active"
      || connection.credentialState !== "ready"
    ) {
      throw new Error("Exact Issue connection is unavailable");
    }
    return connection;
  }
}

export function createTaskWorkspaceService(db: RdbProvider): TaskWorkspaceService {
  const secrets = getSecretProvider(db);
  const githubCredentials = new GitHubCredentialResolver({
    db,
    ...(secrets ? { secrets } : {}),
  });
  return new TaskWorkspaceService({
    db,
    repositoryAccess: new ProjectRemoteAccessFactory({
      githubCredentials,
      githubProvider: (token) => new GitHubIntegrationProvider({ token }),
    }),
    repositoryReader: new RemoteRepositoryReader(),
    issueBranches: new ExactIssueWorkspaceBranches({
      db,
      githubCredentials,
      ...(secrets ? { secrets } : {}),
    }),
    runtimeResolver: {
      getRuntime: async (id) => {
        const runtime = await db.getRuntime(id);
        return runtime ? withDerivedHostLiveness(runtime) : undefined;
      },
    },
  });
}
