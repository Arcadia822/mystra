import { describe, expect, it, vi } from "vitest";

import { RdbError } from "../db/prisma-errors";
import { ProgramOwnedFixedWorkflowRuntime } from "./fixed-workflow-runtime";
import { WorkflowSkillProjectionService } from "./workflow-skill-projection-service";
import { WorkflowWorkloadService } from "./workflow-workload-service";

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const timestamp = "2026-08-25T00:00:00.000Z";

function state(stageId: "understand" | "implement" = "understand", version = 1) {
  return {
    id: id(1), teamId: id(2), taskId: id(3), workflowId: "mystra.workflow" as const,
    stageId, stateVersion: version, activeKey: "mystra.workflow" as const,
    enabledByUserId: id(4), enableCommandId: id(5), enabledAt: timestamp,
    disabledByUserId: null, disableCommandId: null, disabledAt: null, updatedAt: timestamp,
  };
}

function setup(options: { replay?: boolean; transitionError?: Error; runtime?: ProgramOwnedFixedWorkflowRuntime } = {}) {
  const runtime = options.runtime ?? new ProgramOwnedFixedWorkflowRuntime();
  const skillIds = new Map<string, string>();
  let nextSkill = 20;
  const projectionDb = {
    listSkillRecords: vi.fn(async ({ query }: { query?: string }) => {
      if (!skillIds.has(query!)) skillIds.set(query!, id(nextSkill++));
      const skillId = skillIds.get(query!)!;
      return { items: [{
        id: skillId, teamId: id(2), name: query, activeName: query, status: "active",
        currentRevisionId: id(nextSkill + 20), resourceRevision: 1, createdByUserId: id(4),
        createdAt: timestamp, updatedAt: timestamp, archivedByUserId: null, archivedAt: null,
      }], nextCursor: null };
    }),
    getSkillRevisionRecord: vi.fn(async ({ skillId }: { skillId: string }) => ({
      id: id(Number(skillId.slice(-2)) + 40), skillId, baseRevisionId: null, sequence: 1,
      publicationStatus: "ready", description: "Ready", manifest: [{
        path: "SKILL.md", sizeBytes: 1, sha256: "c".repeat(64), mediaType: "text/markdown", previewability: "text",
      }],
      compressedSizeBytes: 1, uncompressedSizeBytes: 1, zipSha256: "a".repeat(64),
      contentSha256: "b".repeat(64), objectKey: "secret", createdByUserId: id(4),
      createdAt: timestamp, readyAt: timestamp, failedAt: null, failureCode: null,
    })),
    replaceWorkflowSkillSources: vi.fn(async ({ sources }: { sources: Array<{ workspaceId: string; skillId: string; skillRevisionId: string; relativePath: string; desiredGeneration: number }> }) => (
      [...new Map(sources.map((source) => [source.skillId, source])).values()].map((source) => ({
        workspaceId: source.workspaceId, skillId: source.skillId, skillRevisionId: source.skillRevisionId,
        relativePath: source.relativePath, desiredGeneration: source.desiredGeneration,
        appliedGeneration: source.desiredGeneration, status: "ready" as const, failureCode: null, updatedAt: timestamp,
      }))
    )),
    listWorkspaceSkillProjections: vi.fn(async () => []),
  };
  const resolved = {
    execution: { session: { id: id(6), teamId: id(2), taskId: id(3) }, workspace: { id: id(7) } },
    capability: { sessionId: id(6), workflowStateId: id(1), teamId: id(2), taskId: id(3), issuedAt: timestamp, revokedAt: null },
    state: state(),
  };
  const execution = { resolveWorkflowExecution: vi.fn(async () => resolved) };
  const transitionTaskWorkflow = vi.fn(async (input: { transition: { toStageId: "implement"; toStateVersion: number } }) => {
    if (options.transitionError) throw options.transitionError;
    const next = state(input.transition.toStageId, input.transition.toStateVersion);
    return { state: next, transition: input.transition, created: !options.replay };
  });
  const skills = new WorkflowSkillProjectionService({ db: projectionDb as never, runtime });
  return {
    runtime, projectionDb, execution, transitionTaskWorkflow,
    service: new WorkflowWorkloadService({
      db: { transitionTaskWorkflow } as never, execution: execution as never, runtime, skills,
      now: () => timestamp, newId: () => id(8),
    }),
  };
}

describe("WorkflowWorkloadService", () => {
  it("returns complete Stage authority and reconciles exact fixed Skill revisions", async () => {
    const { service, projectionDb } = setup();
    const current = await service.current("execution-code");
    expect(current).toMatchObject({
      workflow: { id: "mystra.workflow" },
      state: { stageId: "understand", stateVersion: 1, terminal: false },
      availableActions: [{ id: "understanding-complete", nextStageId: "implement" }],
      projection: { generation: 1, status: "ready" },
    });
    expect(current.requiredSkills).toHaveLength(2);
    expect(JSON.stringify(current)).not.toMatch(/objectKey|secret|taskId|stateId/iu);
    expect(projectionDb.replaceWorkflowSkillSources).toHaveBeenCalledTimes(1);
  });

  it("commits the fixed edge, returns Skill diff, and reports replay", async () => {
    const commandId = id(9);
    const first = setup();
    await expect(first.service.transition("code", {
      commandId, actionId: "understanding-complete", expectedStateVersion: 1,
    })).resolves.toMatchObject({
      transition: { commandId, previousStageId: "understand", currentStageId: "implement", stateVersion: 2, replayed: false },
      current: { state: { stageId: "implement", stateVersion: 2 } },
    });
    expect(first.transitionTaskWorkflow).toHaveBeenCalledWith(expect.objectContaining({ expectedStateVersion: 1 }));

    const replay = setup({ replay: true });
    await expect(replay.service.transition("code", {
      commandId, actionId: "understanding-complete", expectedStateVersion: 1,
    })).resolves.toMatchObject({ transition: { replayed: true } });
  });

  it("classifies invalid Action, state race, and command reuse without retrying on a new Stage", async () => {
    const invalid = setup();
    await expect(invalid.service.transition("code", {
      commandId: id(9), actionId: "verification-passed", expectedStateVersion: 1,
    })).rejects.toMatchObject({ code: "workflow_action_not_allowed" });
    const commandConflict = setup({ transitionError: new RdbError("RDB_CONFLICT", "Workflow command id was reused with different input") });
    await expect(commandConflict.service.transition("code", {
      commandId: id(9), actionId: "understanding-complete", expectedStateVersion: 1,
    })).rejects.toMatchObject({ code: "workflow_command_conflict" });
  });

  it("accepts an internal fixed-runtime substitute without changing transport callers", async () => {
    const base = new ProgramOwnedFixedWorkflowRuntime();
    const definition = structuredClone(base.definition);
    definition.stages[0]!.instructions = "Substitute instruction.";
    const runtime = {
      definition,
      stage: (stageId: Parameters<typeof base.stage>[0]) => definition.stages.find(({ id: candidate }) => candidate === stageId)!,
      action: base.action.bind(base),
      skills: base.skills.bind(base),
    };
    const { service } = setup({ runtime: runtime as ProgramOwnedFixedWorkflowRuntime });
    await expect(service.current("same-code")).resolves.toMatchObject({ stage: { instructions: "Substitute instruction." } });
  });
});
