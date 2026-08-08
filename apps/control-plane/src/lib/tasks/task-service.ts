import type {
  IssueTaskCreateRequest,
  Task,
  TaskCreateResponse,
  TaskIssueResolution,
  TaskIssueProvider,
} from "@mystra/shared";

import type { RdbProvider } from "../db/rdb-provider";
import { IntegrationFailure } from "../integrations/errors";
import type { ProjectIssuesService } from "../integrations/project-issues";

type TaskDb = Pick<
  RdbProvider,
  "createTaskFromIssue" | "getProjectById" | "getProjectIssueSource"
>;

export class TaskService {
  readonly #db: TaskDb;
  readonly #issues: Pick<ProjectIssuesService, "resolveExactIssue">;

  constructor(input: { db: TaskDb; issues: Pick<ProjectIssuesService, "resolveExactIssue"> }) {
    this.#db = input.db;
    this.#issues = input.issues;
  }

  async createFromIssue(
    projectSlug: string,
    teamId: string,
    provider: TaskIssueProvider,
    input: IssueTaskCreateRequest,
  ): Promise<TaskCreateResponse> {
    const resolved = await this.#issues.resolveExactIssue(projectSlug, teamId, provider, input.identifier);
    if (!resolved || resolved.issue.externalId !== input.externalId) {
      throw new IntegrationFailure({ code: "ISSUE_NOT_FOUND", message: "Exact Issue identity could not be verified" });
    }
    return this.#db.createTaskFromIssue({
      teamId,
      projectId: resolved.project.id,
      title: resolved.issue.title,
      description: null,
      issue: {
        provider,
        connectionId: resolved.connectionId,
        scopeExternalId: resolved.scopeExternalId,
        externalId: resolved.issue.externalId,
        identifier: resolved.issue.identifier,
      },
    });
  }

  async resolveIssue(task: Task): Promise<TaskIssueResolution | undefined> {
    if (!task.issue || !task.projectId) return undefined;
    try {
      const project = await this.#db.getProjectById(task.projectId, { teamId: task.teamId });
      if (!project || project.archivedAt) return { status: "unavailable" };
      if (task.issue.provider === "github") {
        if (
          project.repositoryConnectionId !== task.issue.connectionId
          || project.repositoryExternalId !== task.issue.scopeExternalId
        ) return { status: "unavailable" };
      } else {
        const source = await this.#db.getProjectIssueSource(project.id, "linear", { teamId: task.teamId });
        if (
          !source
          || source.connectionId !== task.issue.connectionId
          || source.scopeExternalId !== task.issue.scopeExternalId
        ) return { status: "unavailable" };
      }
      const resolved = await this.#issues.resolveExactIssue(
        project.slug,
        task.teamId,
        task.issue.provider,
        task.issue.identifier,
      );
      if (!resolved || resolved.issue.externalId !== task.issue.externalId) return { status: "unavailable" };
      return {
        status: "available",
        title: resolved.issue.title,
        identifier: resolved.issue.identifier,
        url: resolved.issue.url,
      };
    } catch {
      return { status: "unavailable" };
    }
  }
}
