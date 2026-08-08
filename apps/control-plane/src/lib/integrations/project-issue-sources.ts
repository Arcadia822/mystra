import {
  projectIssueSourceUpsertSchema,
  projectIssueSourcesResponseSchema,
  type ProjectIssueSourcesResponse,
  type ProjectIssueSourceUpsert,
} from "@mystra/shared";

import type { RdbProvider } from "../db/rdb-provider";
import type { SecretProvider } from "../secrets/secret-provider";
import { IntegrationFailure } from "./errors";
import { getLinearTeam } from "./linear-api-key";

type SourceDb = Pick<
  RdbProvider,
  | "deleteProjectIssueSource"
  | "getIntegrationConnectionRecord"
  | "getProjectBySlug"
  | "getProjectIssueSource"
  | "upsertProjectIssueSource"
>;

export class ProjectIssueSourceService {
  readonly #db: SourceDb;
  readonly #secrets: SecretProvider | undefined;
  readonly #resolveTeam: typeof getLinearTeam;

  constructor(input: { db: SourceDb; secrets?: SecretProvider; resolveTeam?: typeof getLinearTeam }) {
    this.#db = input.db;
    this.#secrets = input.secrets;
    this.#resolveTeam = input.resolveTeam ?? getLinearTeam;
  }

  async get(slug: string, teamId: string): Promise<ProjectIssueSourcesResponse> {
    const project = await this.#requireProject(slug, teamId);
    let githubAvailability: "available" | "unavailable" = "available";
    try {
      await this.#requireGitHubConnection(project.repositoryConnectionId, teamId);
    } catch {
      githubAvailability = "unavailable";
    }
    const source = await this.#db.getProjectIssueSource(project.id, "linear", { teamId });
    let linear: ProjectIssueSourcesResponse["linear"] = null;
    if (source) {
      try {
        const connection = await this.#requireLinearConnection(source.connectionId, teamId);
        const team = await this.#resolveTeam(await this.#apiKey(connection.credentialRef), source.scopeExternalId);
        linear = {
          integration: "linear",
          connectionId: source.connectionId,
          linearTeamExternalId: source.scopeExternalId,
          team: { id: team.id, key: team.key, name: team.name },
          availability: "available",
        };
      } catch {
        linear = {
          integration: "linear",
          connectionId: source.connectionId,
          linearTeamExternalId: source.scopeExternalId,
          availability: "unavailable",
        };
      }
    }
    return projectIssueSourcesResponseSchema.parse({
      github: {
        integration: "github",
        connectionId: project.repositoryConnectionId,
        repositoryExternalId: project.repositoryExternalId,
        availability: githubAvailability,
      },
      linear,
    });
  }

  async upsert(slug: string, teamId: string, input: ProjectIssueSourceUpsert) {
    const request = projectIssueSourceUpsertSchema.parse(input);
    const project = await this.#requireProject(slug, teamId);
    const connection = await this.#requireLinearConnection(request.connectionId, teamId);
    const team = await this.#resolveTeam(await this.#apiKey(connection.credentialRef), request.linearTeamExternalId);
    if (team.archivedAt) {
      throw new IntegrationFailure({ code: "ISSUE_SCOPE_UNAVAILABLE", message: "Archived Linear Team cannot be configured" });
    }
    await this.#db.upsertProjectIssueSource({
      teamId,
      projectId: project.id,
      integration: "linear",
      connectionId: connection.id,
      scopeType: "linear-team",
      scopeExternalId: team.id,
    });
    return this.get(slug, teamId);
  }

  async delete(slug: string, teamId: string): Promise<void> {
    const project = await this.#requireProject(slug, teamId);
    await this.#db.deleteProjectIssueSource(project.id, "linear", { teamId });
  }

  async #requireProject(slug: string, teamId: string) {
    const project = await this.#db.getProjectBySlug(slug, { teamId });
    if (!project || project.archivedAt) {
      throw new IntegrationFailure({ code: "ISSUE_SCOPE_UNAVAILABLE", message: "Active Project not found" });
    }
    return project;
  }

  async #requireLinearConnection(id: string, teamId: string) {
    const connection = await this.#db.getIntegrationConnectionRecord(id);
    if (
      !connection
      || connection.teamId !== teamId
      || connection.integration !== "linear"
      || connection.provider !== "linear"
      || connection.authMethod !== "api-key"
      || connection.status !== "active"
      || connection.credentialState !== "ready"
    ) {
      throw new IntegrationFailure({ code: "INTEGRATION_CONNECTION_MISMATCH", message: "Usable Linear connection not found for Team" });
    }
    return connection;
  }

  async #requireGitHubConnection(id: string, teamId: string) {
    const connection = await this.#db.getIntegrationConnectionRecord(id);
    if (
      !connection
      || connection.teamId !== teamId
      || connection.integration !== "github"
      || connection.provider !== "github"
      || connection.status !== "active"
      || connection.credentialState !== "ready"
    ) {
      throw new IntegrationFailure({ code: "ISSUE_SCOPE_UNAVAILABLE", message: "Usable GitHub connection not found for Team" });
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
}
