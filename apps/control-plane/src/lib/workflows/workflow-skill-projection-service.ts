import type {
  SkillManifestEntry,
  TaskWorkflowState,
  WorkflowRequiredSkill,
  WorkflowStageId,
  WorkspaceSkillProjection,
} from "@mystra/shared";

import type { RdbProvider, WorkflowSkillSourceWrite } from "../db/rdb-provider";
import type { FixedWorkflowRuntime } from "./fixed-workflow-runtime";
import { WorkflowFailure } from "./workflow-errors";

type ProjectionDb = Pick<RdbProvider,
  "listSkillRecords" | "getSkillRevisionRecord" | "replaceWorkflowSkillSources" | "listWorkspaceSkillProjections"
>;

export type ResolvedWorkflowSkills = {
  sources: WorkflowSkillSourceWrite[];
  requiredSkills: WorkflowRequiredSkill[];
  artifacts: Array<{
    skillId: string; revisionId: string; relativePath: `.mystra/skills/${string}`;
    zipSha256: string; manifest: SkillManifestEntry[];
  }>;
};

export class WorkflowSkillProjectionService {
  constructor(readonly input: { db: ProjectionDb; runtime: FixedWorkflowRuntime }) {}

  async resolve(input: {
    teamId: string; workspaceId: string; workflowStateId: string;
    stageId: WorkflowStageId; generation: number;
  }): Promise<ResolvedWorkflowSkills> {
    const sources: WorkflowSkillSourceWrite[] = [];
    const required = new Map<string, WorkflowRequiredSkill>();
    const artifacts = new Map<string, ResolvedWorkflowSkills["artifacts"][number]>();
    for (const contribution of this.input.runtime.skills(input.stageId)) {
      const page = await this.input.db.listSkillRecords({
        teamId: input.teamId, query: contribution.name, limit: 100, includeArchived: false,
      });
      const skill = page.items.find((candidate) => candidate.activeName === contribution.name && candidate.status === "active");
      if (!skill?.currentRevisionId) throw unavailable(contribution.name);
      const revision = await this.input.db.getSkillRevisionRecord({
        teamId: input.teamId, skillId: skill.id, revisionId: skill.currentRevisionId,
      });
      if (!revision || revision.publicationStatus !== "ready" || revision.sequence === null) {
        throw unavailable(contribution.name);
      }
      const relativePath = `.mystra/skills/${skill.id}` as const;
      sources.push({
        workspaceId: input.workspaceId,
        sourceKey: `workflow:mystra.workflow:${input.workflowStateId}:${contribution.scope}`,
        skillId: skill.id,
        skillRevisionId: revision.id,
        relativePath,
        desiredGeneration: input.generation,
      });
      required.set(skill.id, {
        skillId: skill.id, revisionId: revision.id, revision: revision.sequence,
        path: relativePath, zipSha256: revision.zipSha256,
      });
      artifacts.set(skill.id, {
        skillId: skill.id, revisionId: revision.id, relativePath,
        zipSha256: revision.zipSha256, manifest: revision.manifest,
      });
    }
    return {
      sources,
      requiredSkills: [...required.values()].sort((left, right) => left.skillId.localeCompare(right.skillId)),
      artifacts: [...artifacts.values()].sort((left, right) => left.skillId.localeCompare(right.skillId)),
    };
  }

  async reconcile(input: {
    teamId: string; workspaceId: string; state: TaskWorkflowState;
  }): Promise<ResolvedWorkflowSkills & { projections: WorkspaceSkillProjection[] }> {
    const desired = await this.resolve({
      teamId: input.teamId, workspaceId: input.workspaceId, workflowStateId: input.state.id,
      stageId: input.state.stageId, generation: input.state.stateVersion,
    });
    const projections = await this.input.db.replaceWorkflowSkillSources({
      teamId: input.teamId, workspaceId: input.workspaceId,
      sourcePrefix: `workflow:mystra.workflow:${input.state.id}:`,
      desiredGeneration: input.state.stateVersion, sources: desired.sources,
    });
    return { ...desired, projections };
  }

  list(teamId: string, workspaceId: string) {
    return this.input.db.listWorkspaceSkillProjections({ teamId, workspaceId });
  }
}

function unavailable(name: string) {
  return new WorkflowFailure("workflow_skill_resolution_failed", `Required Workflow Skill is unavailable: ${name}`);
}
