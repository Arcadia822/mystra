import {
  taskWorkspaceSetupRequestSchema,
  sessionWorkspaceAttachmentSchema,
  taskWorkspaceViewSchema,
  type Project,
  type TaskIssueReference,
  type TaskWorkspaceTrusted,
  type TaskWorkspaceView,
  type WorkspaceBranchDecision,
  type SessionWorkspaceAttachment,
} from "@mystra/shared";

import type { RdbProvider } from "../db/rdb-provider";
import { RdbError } from "../db/prisma-errors";
import type { GitRemoteAccess } from "../git/remote-access";
import type { RemoteRepositoryReader } from "../git/remote-repository-reader";
import {
  requireSafeGitBranchDecision,
  taskFallbackBranch,
} from "./task-workspace-factory";
import { TaskWorkspaceFailure } from "./task-workspace-errors";

const GIT_READ_LIMITS = {
  timeoutMs: 30_000,
  maxRefs: 10_000,
  maxOutputBytes: 8 * 1024 * 1024,
} as const;

type WorkspaceDb = Pick<
  RdbProvider,
  | "getTask"
  | "getProjectById"
  | "getRuntime"
  | "getTaskWorkspace"
  | "createTaskWorkspace"
  | "retryTaskWorkspace"
>;

type RepositoryAccess = { resolve(project: Project): Promise<GitRemoteAccess> };
type IssueBranches = {
  resolve(issue: TaskIssueReference, taskId: string, teamId: string): Promise<WorkspaceBranchDecision>;
};

export type TaskWorkspaceSetupResult = {
  workspace: TaskWorkspaceView;
  created: boolean;
  retried: boolean;
};

export class TaskWorkspaceService {
  readonly #db: WorkspaceDb;
  readonly #repositoryAccess: RepositoryAccess;
  readonly #repositoryReader: Pick<RemoteRepositoryReader, "resolveBranch">;
  readonly #issueBranches: IssueBranches;
  readonly #runtimeResolver: Pick<RdbProvider, "getRuntime">;

  constructor(input: {
    db: WorkspaceDb;
    repositoryAccess: RepositoryAccess;
    repositoryReader: Pick<RemoteRepositoryReader, "resolveBranch">;
    issueBranches: IssueBranches;
    runtimeResolver?: Pick<RdbProvider, "getRuntime">;
  }) {
    this.#db = input.db;
    this.#repositoryAccess = input.repositoryAccess;
    this.#repositoryReader = input.repositoryReader;
    this.#issueBranches = input.issueBranches;
    this.#runtimeResolver = input.runtimeResolver ?? input.db;
  }

  async setup(input: {
    actor: { teamId: string };
    taskId: string;
    runtimeId: string;
    idempotencyKey: string;
  }): Promise<TaskWorkspaceSetupResult> {
    const request = taskWorkspaceSetupRequestSchema.parse({
      runtimeId: input.runtimeId,
      idempotencyKey: input.idempotencyKey,
    });
    const task = await this.#db.getTask(input.taskId, { teamId: input.actor.teamId });
    if (!task) {
      throw new TaskWorkspaceFailure("workspace_missing", "Task is unavailable");
    }
    if (task.runtimeId !== request.runtimeId) {
      throw new TaskWorkspaceFailure(
        "workspace_runtime_mismatch",
        "Task Runtime Context does not match the requested Workspace Runtime",
      );
    }
    const existing = await this.#db.getTaskWorkspace(task.id, {
      teamId: input.actor.teamId,
      runtimeId: request.runtimeId,
    });
    if (existing) return this.#useExisting(existing, input.actor.teamId, request.runtimeId);
    if (!task.projectId) {
      throw new TaskWorkspaceFailure("task_project_required", "Task requires Project context");
    }
    const project = await this.#db.getProjectById(task.projectId, { teamId: input.actor.teamId });
    if (!project || project.archivedAt) {
      throw new TaskWorkspaceFailure("repository_unavailable", "Active Project repository is unavailable");
    }
    await this.#requireRuntime(request.runtimeId);

    const base = await this.#resolveBase(project);
    const branch = task.issue
      ? await this.#resolveIssueBranch(task.issue, task.id, input.actor.teamId)
      : taskFallbackBranch(task.id);
    const safeBranch = requireSafeGitBranchDecision(branch);
    try {
      const created = await this.#db.createTaskWorkspace({
        teamId: input.actor.teamId,
        taskId: task.id,
        projectId: project.id,
        runtimeId: request.runtimeId,
        connectionId: project.repositoryConnectionId,
        repositoryExternalId: project.repositoryExternalId,
        configuredBaseBranch: project.repositoryBaseBranch,
        issueProvider: task.issue?.provider ?? null,
        issueConnectionId: task.issue?.connectionId ?? null,
        issueScopeExternalId: task.issue?.scopeExternalId ?? null,
        issueExternalId: task.issue?.externalId ?? null,
        baseRef: base.ref,
        baseCommit: base.commit,
        branchName: safeBranch.branchName,
        branchStrategy: safeBranch.strategy,
      });
      return {
        workspace: toTaskWorkspaceView(created.workspace),
        created: created.created,
        retried: false,
      };
    } catch (error) {
      if (error instanceof RdbError && error.code === "TASK_WORKSPACE_CONFLICT") {
        throw new TaskWorkspaceFailure(
          "workspace_already_prepared",
          "Task already has a different Workspace intent",
        );
      }
      throw error;
    }
  }

  async get(input: { actor: { teamId: string }; taskId: string; runtimeId: string }): Promise<TaskWorkspaceView | undefined> {
    const workspace = await this.#db.getTaskWorkspace(input.taskId, {
      teamId: input.actor.teamId,
      runtimeId: input.runtimeId,
    });
    return workspace ? toTaskWorkspaceView(workspace) : undefined;
  }

  async resolveSessionAttachment(input: {
    teamId: string;
    taskId: string;
    requestedRuntimeId: string;
  }): Promise<SessionWorkspaceAttachment> {
    const workspace = await this.#db.getTaskWorkspace(input.taskId, {
      teamId: input.teamId,
      runtimeId: input.requestedRuntimeId,
    });
    if (!workspace || workspace.state === "unavailable") {
      throw new TaskWorkspaceFailure("workspace_missing", "Ready Task Workspace is unavailable");
    }
    if (workspace.runtimeId !== input.requestedRuntimeId) {
      throw new TaskWorkspaceFailure(
        "workspace_runtime_mismatch",
        "Session Runtime must match the Task Workspace Runtime",
      );
    }
    if (workspace.state !== "ready" || !workspace.workspaceRef) {
      throw new TaskWorkspaceFailure("workspace_not_ready", "Task Workspace is not ready");
    }
    await this.#requireRuntime(workspace.runtimeId);
    return sessionWorkspaceAttachmentSchema.parse({
      kind: "task",
      taskWorkspaceId: workspace.id,
      runtimeId: workspace.runtimeId,
      workspaceRef: workspace.workspaceRef,
      sharingMode: "shared-mutable",
    });
  }

  async #useExisting(
    workspace: TaskWorkspaceTrusted,
    teamId: string,
    runtimeId: string,
  ): Promise<TaskWorkspaceSetupResult> {
    if (workspace.runtimeId !== runtimeId) {
      throw new TaskWorkspaceFailure(
        "workspace_already_prepared",
        "Task Workspace is locked to another Runtime",
      );
    }
    if (workspace.state === "failed") {
      await this.#requireRuntime(runtimeId);
      const retried = await this.#db.retryTaskWorkspace({
        workspaceId: workspace.id,
        teamId,
        runtimeId,
      });
      return { workspace: toTaskWorkspaceView(retried.workspace), created: false, retried: true };
    }
    return { workspace: toTaskWorkspaceView(workspace), created: false, retried: false };
  }

  async #requireRuntime(runtimeId: string): Promise<void> {
    const runtime = await this.#runtimeResolver.getRuntime(runtimeId);
    if (!runtime || runtime.status !== "online") {
      throw new TaskWorkspaceFailure("runtime_unavailable", "Selected Runtime is unavailable");
    }
    const capability = runtime.metadata.workspaceMaterialization;
    if (
      !capability
      || !capability.kinds.includes("task-repository")
      || !capability.sharingModes.includes("shared-mutable")
    ) {
      throw new TaskWorkspaceFailure(
        "workspace_capability_unavailable",
        "Selected Runtime cannot materialize Task repositories",
      );
    }
  }

  async #resolveBase(project: Project) {
    try {
      const access = await this.#repositoryAccess.resolve(project);
      return await this.#repositoryReader.resolveBranch({
        access,
        branch: project.repositoryBaseBranch,
        ...GIT_READ_LIMITS,
      });
    } catch {
      throw new TaskWorkspaceFailure(
        "repository_unavailable",
        "Configured Project repository branch is unavailable",
      );
    }
  }

  async #resolveIssueBranch(issue: TaskIssueReference, taskId: string, teamId: string) {
    try {
      return await this.#issueBranches.resolve(issue, taskId, teamId);
    } catch {
      throw new TaskWorkspaceFailure(
        "issue_branch_unavailable",
        "Exact Issue branch strategy is unavailable",
      );
    }
  }
}

export function toTaskWorkspaceView(workspace: TaskWorkspaceTrusted): TaskWorkspaceView {
  return taskWorkspaceViewSchema.parse({
    id: workspace.id,
    taskId: workspace.taskId,
    projectId: workspace.projectId,
    runtimeId: workspace.runtimeId,
    state: workspace.state,
    sharingMode: workspace.sharingMode,
    configuredBaseBranch: workspace.configuredBaseBranch,
    baseRef: workspace.baseRef,
    baseCommit: workspace.baseCommit,
    branchName: workspace.branchName,
    branchStrategy: workspace.branchStrategy,
    failure: workspace.failureCode
      ? { code: workspace.failureCode, message: workspace.failureMessage }
      : null,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
    readyAt: workspace.readyAt,
  });
}
