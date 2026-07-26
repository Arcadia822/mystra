import {
  issueDispatchRequestSchema,
  type IssueDispatchRequest,
} from "@mystra/shared";

import type { RdbProvider, JobSnapshot } from "../db/rdb-provider";
import { IntegrationFailure } from "./errors";
import type { IntegrationRegistry } from "./registry";

export async function dispatchIssue(input: {
  integrationName: string;
  identifier: string;
  request: IssueDispatchRequest;
  registry: IntegrationRegistry;
  db: RdbProvider;
}): Promise<JobSnapshot> {
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
    request.branchName,
  ].join(":");
  const description = issue.description?.trim() || "No additional description was provided.";
  const prompt = [
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
    return input.db.createJob({
      taskId: issue.reference.identifier,
      source: "issue",
      projectId: project.id,
      branchName: request.branchName,
      agent: request.agent,
      prompt,
      issue,
      dispatchKey,
      mergeRequest,
      ...(request.runtime ? { runtime: request.runtime } : {}),
      metadata: {
        integration: input.integrationName,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("DISPATCH_CONFLICT")) {
      const existing = input.db.getJobByDispatchKey(dispatchKey);
      throw new IntegrationFailure({
        code: "DISPATCH_CONFLICT",
        message: `Issue dispatch already exists: ${issue.reference.identifier}`,
        ...(existing ? { details: { existingJobId: existing.job.id } } : {}),
      });
    }
    throw error;
  }
}
