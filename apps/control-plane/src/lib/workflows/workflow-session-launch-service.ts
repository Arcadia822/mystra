import type { SessionWorkflowCapability } from "@mystra/shared";

import type { RdbProvider } from "../db/rdb-provider";
import type { FixedWorkflowRuntime } from "./fixed-workflow-runtime";
import { WorkflowSkillProjectionService } from "./workflow-skill-projection-service";

export class WorkflowSessionLaunchService {
  readonly #db: Pick<RdbProvider, "getActiveTaskWorkflowState">;
  readonly #runtime: FixedWorkflowRuntime;
  readonly #skills: WorkflowSkillProjectionService;
  readonly #now: () => string;

  constructor(input: {
    db: Pick<RdbProvider, "getActiveTaskWorkflowState">;
    runtime: FixedWorkflowRuntime;
    skills: WorkflowSkillProjectionService;
    now?: () => string;
  }) {
    this.#db = input.db;
    this.#runtime = input.runtime;
    this.#skills = input.skills;
    this.#now = input.now ?? (() => new Date().toISOString());
  }

  async prepare(input: {
    teamId: string; taskId: string; sessionId: string; workspaceId: string;
  }): Promise<{ prompt: string; capability: SessionWorkflowCapability } | undefined> {
    const state = await this.#db.getActiveTaskWorkflowState(input.taskId, { teamId: input.teamId });
    if (!state) return undefined;
    await this.#skills.reconcile({ teamId: input.teamId, workspaceId: input.workspaceId, state });
    return {
      prompt: this.#runtime.definition.prompt,
      capability: {
        sessionId: input.sessionId, workflowStateId: state.id,
        teamId: input.teamId, taskId: input.taskId,
        issuedAt: this.#now(), revokedAt: null,
      },
    };
  }
}
