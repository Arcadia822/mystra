import {
  issueDispatchRequestSchema,
  type IssueDispatchRequest,
} from "@mystra/shared";

import type { IssueDispatchResult, RdbProvider } from "../db/rdb-provider";
import { IntegrationFailure } from "./errors";
import type { IntegrationRegistry } from "./registry";

export async function dispatchIssue(input: {
  integrationName: string;
  identifier: string;
  request: IssueDispatchRequest;
  registry: IntegrationRegistry;
  db: RdbProvider;
}): Promise<IssueDispatchResult> {
  const request = issueDispatchRequestSchema.parse(input.request);
  const provider = input.registry.requireIssueProvider(input.integrationName);
  const project = input.db.getProjectById(request.projectId);
  if (!project) {
    throw new Error(`PROJECT_NOT_FOUND: Project not found: ${request.projectId}`);
  }
  if (project.archivedAt) {
    throw new Error(`PROJECT_ARCHIVED: Project is archived: ${project.slug}`);
  }
  if (project.runtime.provider !== "docker") {
    throw new Error(`INVALID_RUNTIME: Issue dispatch requires a Docker runtime: ${project.slug}`);
  }
  const issue = await provider.getIssue({
    identifier: input.identifier,
    repository: project.repository,
  });
  if (!issue) {
    throw new IntegrationFailure({
      code: "ISSUE_NOT_FOUND",
      message: `Issue not found: ${input.identifier}`,
    });
  }

  const dispatchKey = [
    input.integrationName,
    issue.reference.externalId,
    project.id,
  ].join(":");
  const description = issue.description?.trim() || "No additional description was provided.";
  const objective = request.sessionObjective ?? [
    `Issue ${issue.reference.identifier}: ${issue.title}`,
    "",
    description,
    "",
    `Source: ${issue.reference.url}`,
  ].join("\n");
  const mergeRequest = {
    title: request.mergeRequest?.title ?? `[${issue.reference.identifier}] ${issue.title}`,
    body: request.mergeRequest?.body
      ?? `Implements [${issue.reference.identifier}](${issue.reference.url}).`,
  };

  try {
    return input.db.dispatchIssue({
      task: {
        source: "issue",
        projectId: project.id,
        objective: issue.title,
        issue,
        dispatchKey,
        repository: project.repository,
        metadata: { integration: input.integrationName },
      },
      session: {
        title: `Implement ${issue.reference.identifier}`,
        objective,
        branch: request.branch,
        agent: request.agent,
        mergeRequest,
        ...(request.runtime ? { runtime: request.runtime } : {}),
        metadata: { integration: input.integrationName },
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("DISPATCH_CONFLICT")) {
      const existing = input.db.getTaskByDispatchKey(dispatchKey);
      throw new IntegrationFailure({
        code: "DISPATCH_CONFLICT",
        message: `Issue dispatch already exists: ${issue.reference.identifier}`,
        ...(existing ? { details: { existingTaskId: existing.id } } : {}),
      });
    }
    throw error;
  }
}
