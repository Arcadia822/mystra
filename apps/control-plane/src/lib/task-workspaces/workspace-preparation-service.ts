import {
  workspacePreparationClaimSchema,
  workspacePreparationReportSchema,
  workspaceAvailabilityReportSchema,
  type WorkspacePreparationClaim,
  type WorkspacePreparationReport,
} from "@mystra/shared";

import type { RdbProvider } from "../db/rdb-provider";
import { RdbError } from "../db/prisma-errors";
import type { ProjectRemoteAccessFactory } from "../git/remote-access-factory";
import { readGitRemoteAccess } from "../git/remote-access";
import { TaskWorkspaceFailure } from "./task-workspace-errors";

type PreparationDb = Pick<
  RdbProvider,
  "claimTaskWorkspacePreparation" | "completeTaskWorkspacePreparation" | "getProjectById"
  | "getTaskWorkspaceById" | "getRuntime" | "markTaskWorkspaceUnavailable"
>;

export class WorkspacePreparationService {
  readonly #db: PreparationDb;
  readonly #repositoryAccess: Pick<ProjectRemoteAccessFactory, "resolve">;
  readonly #now: () => Date;
  readonly #sleep: (milliseconds: number) => Promise<void>;

  constructor(input: {
    db: PreparationDb;
    repositoryAccess: Pick<ProjectRemoteAccessFactory, "resolve">;
    now?: () => Date;
    sleep?: (milliseconds: number) => Promise<void>;
  }) {
    this.#db = input.db;
    this.#repositoryAccess = input.repositoryAccess;
    this.#now = input.now ?? (() => new Date());
    this.#sleep = input.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  async claim(input: { runnerId: string; waitSeconds: number }): Promise<WorkspacePreparationClaim | undefined> {
    const deadline = this.#now().getTime() + input.waitSeconds * 1_000;
    while (true) {
      const now = this.#now();
      const claimed = await this.#db.claimTaskWorkspacePreparation({
        runnerId: input.runnerId,
        leaseExpiresAt: new Date(now.getTime() + 60_000).toISOString(),
      });
      if (claimed) return this.#buildClaim(claimed, input.runnerId);
      const remaining = deadline - this.#now().getTime();
      if (remaining <= 0) return undefined;
      await this.#sleep(Math.min(500, remaining));
    }
  }

  async report(input: {
    workspaceId: string;
    attemptId: string;
    report: WorkspacePreparationReport;
  }) {
    const report = workspacePreparationReportSchema.parse(input.report);
    try {
      return await this.#db.completeTaskWorkspacePreparation({
        workspaceId: input.workspaceId,
        attemptId: input.attemptId,
        ...report,
      });
    } catch (error) {
      if (error instanceof RdbError && (
        error.code === "STALE_WORKSPACE_ATTEMPT"
        || error.code === "TASK_WORKSPACE_CONFLICT"
      )) {
        throw new TaskWorkspaceFailure(
          "stale_workspace_attempt",
          "Workspace preparation attempt is stale or foreign",
        );
      }
      throw error;
    }
  }

  async reportMissing(input: {
    workspaceId: string;
    report: { runnerId: string; status: "missing"; failure: { code: "workspace_missing"; message: string } };
  }) {
    const report = workspaceAvailabilityReportSchema.parse(input.report);
    const workspace = await this.#db.getTaskWorkspaceById(input.workspaceId);
    if (!workspace) {
      throw new TaskWorkspaceFailure("workspace_missing", "Task Workspace is unavailable");
    }
    const runtime = await this.#db.getRuntime(workspace.runtimeId);
    if (!runtime || runtime.metadata.runnerId !== report.runnerId) {
      throw new TaskWorkspaceFailure(
        "workspace_runtime_mismatch",
        "Runner does not own the Task Workspace Runtime",
      );
    }
    try {
      return await this.#db.markTaskWorkspaceUnavailable({
        workspaceId: workspace.id,
        runtimeId: runtime.id,
        failureMessage: report.failure.message,
      });
    } catch (error) {
      if (error instanceof RdbError && error.code === "TASK_WORKSPACE_CONFLICT") {
        throw new TaskWorkspaceFailure("workspace_not_ready", "Task Workspace cannot be marked missing");
      }
      throw error;
    }
  }

  async #buildClaim(
    claimed: Awaited<ReturnType<PreparationDb["claimTaskWorkspacePreparation"]>> & {},
    runnerId: string,
  ): Promise<WorkspacePreparationClaim> {
    try {
      const project = await this.#db.getProjectById(claimed.workspace.projectId, {
        teamId: claimed.workspace.teamId,
      });
      if (
        !project
        || project.repositoryConnectionId !== claimed.workspace.connectionId
        || project.repositoryExternalId !== claimed.workspace.repositoryExternalId
      ) {
        throw new Error("Frozen Workspace repository no longer matches Project");
      }
      const material = readGitRemoteAccess(await this.#repositoryAccess.resolve(project));
      if (!material.credential) throw new Error("Repository credential is unavailable");
      return workspacePreparationClaimSchema.parse({
        workspaceId: claimed.workspace.id,
        attemptId: claimed.attempt.id,
        attemptSequence: claimed.attempt.sequence,
        leaseExpiresAt: claimed.attempt.leaseExpiresAt,
        workspaceRef: `host-task-workspace:${claimed.workspace.id}`,
        repository: {
          provider: "github",
          connectionId: claimed.workspace.connectionId,
          repositoryExternalId: claimed.workspace.repositoryExternalId,
          baseRef: claimed.workspace.baseRef,
          baseCommit: claimed.workspace.baseCommit,
          transport: { kind: "https", endpoint: material.endpoint },
        },
        branch: {
          name: claimed.workspace.branchName,
          strategy: claimed.workspace.branchStrategy,
        },
        credential: { kind: "http-basic-token", secret: material.credential.secret },
      });
    } catch {
      await this.#db.completeTaskWorkspacePreparation({
        workspaceId: claimed.workspace.id,
        attemptId: claimed.attempt.id,
        runnerId,
        attemptSequence: claimed.attempt.sequence,
        status: "failed",
        failure: {
          code: "materialization_failed",
          message: "Repository access could not be prepared",
        },
      });
      throw new TaskWorkspaceFailure(
        "repository_unavailable",
        "Workspace repository access is unavailable",
      );
    }
  }
}
