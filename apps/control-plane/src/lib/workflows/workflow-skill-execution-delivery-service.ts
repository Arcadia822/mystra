import { workflowSkillProjectionReportSchema, type WorkflowSkillProjectionReport } from "@mystra/shared";

import type { RdbProvider } from "../db/rdb-provider";
import type { SkillDownload, SkillPreviewService } from "../skills/skill-preview-service";
import type { AgentExecutionService } from "../tasks/agent-execution-service";
import { WorkflowFailure } from "./workflow-errors";

type DeliveryDb = Pick<RdbProvider, "listWorkspaceSkillProjections" | "reportWorkspaceSkillProjection">;

export class WorkflowSkillExecutionDeliveryService {
  constructor(readonly input: {
    db: DeliveryDb;
    execution: Pick<AgentExecutionService, "resolveWorkflowExecution">;
    preview: Pick<SkillPreviewService, "download">;
    now?: () => string;
  }) {}

  async download(input: { code: string; skillId: string; revisionId: string }): Promise<SkillDownload> {
    const resolved = await this.input.execution.resolveWorkflowExecution(input.code);
    const teamId = resolved.execution.session.teamId;
    const workspaceId = resolved.execution.workspace.id;
    const desired = await this.input.db.listWorkspaceSkillProjections({ teamId, workspaceId });
    if (!desired.some((item) => item.skillId === input.skillId && item.skillRevisionId === input.revisionId)) {
      throw new WorkflowFailure("scope_mismatch", "Workflow Skill is outside the Session capability");
    }
    return this.input.preview.download({ teamId, skillId: input.skillId, revisionId: input.revisionId });
  }

  async report(input: { code: string; report: unknown }): Promise<{ accepted: boolean; report: WorkflowSkillProjectionReport }> {
    const report = workflowSkillProjectionReportSchema.parse(input.report);
    const resolved = await this.input.execution.resolveWorkflowExecution(input.code);
    const teamId = resolved.execution.session.teamId;
    const workspaceId = resolved.execution.workspace.id;
    if (report.workspaceId !== workspaceId) throw new WorkflowFailure("scope_mismatch", "Workflow Skill report is outside the Session capability");
    const desired = await this.input.db.listWorkspaceSkillProjections({ teamId, workspaceId });
    if (report.results.some((result) => !desired.some((item) => item.skillId === result.skillId))) {
      throw new WorkflowFailure("scope_mismatch", "Workflow Skill report is outside the Session capability");
    }
    const outcomes = await Promise.all(report.results.map((result) => this.input.db.reportWorkspaceSkillProjection({
      teamId, workspaceId, skillId: result.skillId, desiredGeneration: report.generation,
      status: result.status, failureCode: result.failureCode,
      reportedAt: this.input.now?.() ?? new Date().toISOString(),
    })));
    return { accepted: outcomes.every(({ accepted }) => accepted), report };
  }
}
