import { createHash } from "node:crypto";

import { workflowSkillProjectionReportSchema, type WorkflowSkillProjectionReport } from "@mystra/shared";

import type { RdbProvider } from "../db/rdb-provider";
import type { SkillDownload, SkillPreviewService } from "../skills/skill-preview-service";
import { SessionFailure } from "../sessions/session-errors";

type DeliveryDb = Pick<RdbProvider,
  "validateSessionLease" | "getSession" | "getSessionWorkflowCapability" | "getTaskWorkflowState" |
  "getTaskWorkspace" | "listWorkspaceSkillProjections" | "reportWorkspaceSkillProjection"
>;

export class WorkflowSkillDeliveryService {
  constructor(readonly input: { db: DeliveryDb; preview: Pick<SkillPreviewService, "download">; now?: () => string }) {}

  async download(input: {
    sessionId: string; teamId: string; leaseToken: string; skillId: string; revisionId: string;
  }): Promise<SkillDownload> {
    const context = await this.#authorize(input);
    const projections = await this.input.db.listWorkspaceSkillProjections({ teamId: input.teamId, workspaceId: context.workspaceId });
    if (!projections.some((item) => item.skillId === input.skillId && item.skillRevisionId === input.revisionId)) {
      throw new SessionFailure("lease_invalid", "Workflow Skill delivery is not authorized");
    }
    return this.input.preview.download({ teamId: input.teamId, skillId: input.skillId, revisionId: input.revisionId });
  }

  async report(input: {
    sessionId: string; teamId: string; leaseToken: string; report: unknown;
  }): Promise<{ accepted: boolean; report: WorkflowSkillProjectionReport }> {
    const report = workflowSkillProjectionReportSchema.parse(input.report);
    const context = await this.#authorize(input);
    if (report.workspaceId !== context.workspaceId) throw new SessionFailure("lease_invalid", "Workflow Skill report is not authorized");
    const desired = await this.input.db.listWorkspaceSkillProjections({ teamId: input.teamId, workspaceId: context.workspaceId });
    if (report.results.some((result) => !desired.some((item) => item.skillId === result.skillId))) {
      throw new SessionFailure("lease_invalid", "Workflow Skill report contains an unauthorized Skill");
    }
    const outcomes = await Promise.all(report.results.map((result) => this.input.db.reportWorkspaceSkillProjection({
      teamId: input.teamId, workspaceId: context.workspaceId, skillId: result.skillId,
      desiredGeneration: report.generation, status: result.status, failureCode: result.failureCode,
      reportedAt: this.input.now?.() ?? new Date().toISOString(),
    })));
    return { accepted: outcomes.every((outcome) => outcome.accepted), report };
  }

  async #authorize(input: { sessionId: string; teamId: string; leaseToken: string }) {
    const valid = await this.input.db.validateSessionLease({
      sessionId: input.sessionId,
      leaseTokenHash: createHash("sha256").update(input.leaseToken).digest("hex"),
    });
    if (!valid) throw new SessionFailure("lease_invalid", "Workflow Skill delivery is not authorized");
    const session = await this.input.db.getSession(input.sessionId, { teamId: input.teamId });
    const capability = await this.input.db.getSessionWorkflowCapability(input.sessionId);
    if (!session || !capability || capability.revokedAt !== null || capability.teamId !== input.teamId || capability.taskId !== session.taskId) {
      throw new SessionFailure("lease_invalid", "Workflow Skill delivery is not authorized");
    }
    const state = await this.input.db.getTaskWorkflowState(capability.workflowStateId, { teamId: input.teamId });
    if (!state || state.activeKey === null || state.taskId !== session.taskId) {
      throw new SessionFailure("lease_invalid", "Workflow Skill delivery is not authorized");
    }
    const workspace = await this.input.db.getTaskWorkspace(session.taskId, { teamId: input.teamId, runtimeId: session.runtimeId });
    if (!workspace) throw new SessionFailure("lease_invalid", "Workflow Skill delivery is not authorized");
    return { workspaceId: workspace.id, state };
  }
}
