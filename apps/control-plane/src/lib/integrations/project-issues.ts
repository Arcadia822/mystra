import {
  githubIssueListResponseSchema,
  linearIssueListResponseSchema,
  type GitHubIssueListRequest,
  type LinearIssueListRequest,
  type ProjectIssueListResponse,
} from "@mystra/shared";

import type { RdbProvider } from "../db/rdb-provider";
import type { SecretProvider } from "../secrets/secret-provider";
import { IntegrationFailure } from "./errors";
import type { GitHubCredentialResolver } from "./github-credential";
import { GitHubIntegrationProvider } from "./github";
import { LinearIssueProvider } from "./linear";
import { decodeProjectIssueCursor, encodeProjectIssueCursor, type ProjectIssueCursorScope } from "./project-issue-cursor";

type IssuesDb = Pick<
  RdbProvider,
  "getIntegrationConnectionRecord" | "getProjectBySlug" | "getProjectIssueSource"
>;

type GitHubProvider = Pick<GitHubIntegrationProvider, "listProjectIssues">;
type LinearProvider = Pick<LinearIssueProvider, "listProjectIssues">;

export class ProjectIssuesService {
  readonly #db: IssuesDb;
  readonly #secrets: SecretProvider | undefined;
  readonly #githubCredentials: Pick<GitHubCredentialResolver, "resolve">;
  readonly #githubProvider: (token: string) => GitHubProvider;
  readonly #linearProvider: (apiKey: string) => LinearProvider;

  constructor(input: {
    db: IssuesDb;
    githubCredentials: Pick<GitHubCredentialResolver, "resolve">;
    secrets?: SecretProvider;
    githubProvider?: (token: string) => GitHubProvider;
    linearProvider?: (apiKey: string) => LinearProvider;
  }) {
    this.#db = input.db;
    this.#secrets = input.secrets;
    this.#githubCredentials = input.githubCredentials;
    this.#githubProvider = input.githubProvider ?? ((token) => new GitHubIntegrationProvider({ token }));
    this.#linearProvider = input.linearProvider ?? ((apiKey) => new LinearIssueProvider({ apiKey }));
  }

  async listGitHub(slug: string, teamId: string, input: GitHubIssueListRequest): Promise<ProjectIssueListResponse> {
    const project = await this.#requireProject(slug, teamId);
    const connection = await this.#requireConnection(project.repositoryConnectionId, teamId, "github");
    const scope = this.#scope("github", project.id, connection.id, project.repositoryExternalId);
    const after = input.after ? decodeProjectIssueCursor(input.after, scope) : undefined;
    const resolved = await this.#githubCredentials.resolve(connection.id);
    if (resolved.connection.id !== connection.id) {
      throw new IntegrationFailure({ code: "INTEGRATION_CONNECTION_MISMATCH", message: "GitHub credential connection mismatch" });
    }
    const result = await this.#githubProvider(resolved.credential.secret).listProjectIssues({
      ...input,
      ...(after ? { after } : {}),
      repositoryExternalId: project.repositoryExternalId,
    });
    return githubIssueListResponseSchema.parse({
      ...result,
      pageInfo: {
        hasNextPage: result.pageInfo.hasNextPage,
        ...(result.pageInfo.endCursor
          ? { endCursor: encodeProjectIssueCursor(scope, result.pageInfo.endCursor) }
          : {}),
      },
    });
  }

  async listLinear(slug: string, teamId: string, input: LinearIssueListRequest): Promise<ProjectIssueListResponse> {
    const project = await this.#requireProject(slug, teamId);
    const source = await this.#db.getProjectIssueSource(project.id, "linear", { teamId });
    if (!source) {
      throw new IntegrationFailure({ code: "ISSUE_SOURCE_NOT_CONFIGURED", message: "Linear Issue source is not configured for Project" });
    }
    const connection = await this.#requireConnection(source.connectionId, teamId, "linear");
    const scope = this.#scope("linear", project.id, connection.id, source.scopeExternalId);
    const after = input.after ? decodeProjectIssueCursor(input.after, scope) : undefined;
    const result = await this.#linearProvider(await this.#apiKey(connection.credentialRef)).listProjectIssues({
      ...input,
      ...(after ? { after } : {}),
      linearTeamExternalId: source.scopeExternalId,
    });
    return linearIssueListResponseSchema.parse({
      ...result,
      pageInfo: {
        hasNextPage: result.pageInfo.hasNextPage,
        ...(result.pageInfo.endCursor
          ? { endCursor: encodeProjectIssueCursor(scope, result.pageInfo.endCursor) }
          : {}),
      },
    });
  }

  async #requireProject(slug: string, teamId: string) {
    const project = await this.#db.getProjectBySlug(slug, { teamId });
    if (!project || project.archivedAt) {
      throw new IntegrationFailure({ code: "ISSUE_SCOPE_UNAVAILABLE", message: "Active Project not found" });
    }
    return project;
  }

  async #requireConnection(id: string, teamId: string, integration: "github" | "linear") {
    const connection = await this.#db.getIntegrationConnectionRecord(id);
    if (
      !connection
      || connection.teamId !== teamId
      || connection.integration !== integration
      || connection.provider !== integration
      || connection.status !== "active"
      || connection.credentialState !== "ready"
    ) {
      throw new IntegrationFailure({ code: "ISSUE_SCOPE_UNAVAILABLE", message: `Usable ${integration} source is unavailable` });
    }
    return connection;
  }

  async #apiKey(reference: string | undefined): Promise<string> {
    if (!reference || !this.#secrets) {
      throw new IntegrationFailure({ code: "INTEGRATION_CREDENTIAL_UNAVAILABLE", message: "Linear API key is unavailable" });
    }
    try {
      return await this.#secrets.get(reference);
    } catch {
      throw new IntegrationFailure({ code: "INTEGRATION_CREDENTIAL_UNAVAILABLE", message: "Linear API key is unavailable" });
    }
  }

  #scope(
    provider: "github" | "linear",
    projectId: string,
    connectionId: string,
    scopeExternalId: string,
  ): ProjectIssueCursorScope {
    return { provider, projectId, connectionId, scopeExternalId };
  }
}
