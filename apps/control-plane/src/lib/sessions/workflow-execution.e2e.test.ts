import { afterEach, describe, expect, it } from "vitest";
import { effectiveSystemPromptEvidenceSchema } from "@mystra/shared";

import { createSessionE2eFixture } from "../../../test/session-e2e-support";
import { AgentExecutionService } from "../tasks/agent-execution-service";
import { WorkflowManagementService } from "../workflows/workflow-management-service";
import { WorkflowWorkloadService } from "../workflows/workflow-workload-service";

let fixture: Awaited<ReturnType<typeof createSessionE2eFixture>> | undefined;

afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});

describe("fixed Workflow SQLite E2E", () => {
  it("enables, launches, recovers a committed projection, completes, disables, and re-enables without reviving the old Session", async () => {
    fixture = await createSessionE2eFixture();
    await publishFixedSkills(fixture);
    const management = new WorkflowManagementService({ db: fixture.db });
    const actor = { userId: fixture.actor.actorId, role: "owner" as const };
    const enabled = await management.enable({
      teamId: fixture.actor.teamId, taskId: fixture.task.id, actor,
      request: { commandId: crypto.randomUUID() },
    });
    expect(enabled.workflow).toMatchObject({ stageId: "understand", stateVersion: 1, active: true });

    const started = await fixture.production.start({
      actor: fixture.actor, taskId: fixture.task.id,
      request: {
        runtimeId: fixture.runtime.id, providerKey: "codex", expectedRevision: 1,
        idempotencyKey: crypto.randomUUID(),
      },
    });
    const assignment = await fixture.runtimeSessions.claim({
      runtimeId: fixture.runtime.id, request: { runnerId: fixture.runnerId, waitSeconds: 0 },
    });
    expect(assignment).toBeDefined();
    expect(assignment?.workflowSkills?.generation).toBe(1);
    expect(assignment?.execution?.capabilities).toContain("workflow:transition");
    expect(assignment?.systemPrompt).toContain("read the current Workflow stage using the Runtime-provided workload CLI");
    expect(assignment?.systemPrompt).not.toContain(enabled.workflow.stateId);
    const promptEvidence = effectiveSystemPromptEvidenceSchema.parse(
      (await fixture.db.listSessionEvents({ sessionId: assignment!.session.id, teamId: fixture.actor.teamId, limit: 100 }))
        .events.find((event) => event.kind === "session.system_prompt_configured")?.payload,
    );
    expect(promptEvidence.components.find((component) => component.name === "standard")?.content)
      .not.toContain('"$MYSTRA_AGENT_PATH"');
    expect(promptEvidence.components.find((component) => component.name === "runtime_workload")?.content)
      .toContain('"$MYSTRA_AGENT_PATH"');

    const execution = new AgentExecutionService({ db: fixture.db });
    const workload = new WorkflowWorkloadService({
      db: fixture.db, execution, runtime: fixture.workflowRuntime, skills: fixture.workflowSkills,
    });
    const code = assignment!.execution!.code;
    const initial = await workload.current(code);
    expect(initial).toMatchObject({ state: { stageId: "understand", stateVersion: 1 }, projection: { status: "pending" } });

    const implement = await workload.transition(code, {
      commandId: crypto.randomUUID(), actionId: "understanding-complete", expectedStateVersion: 1,
    });
    expect(implement.current).toMatchObject({ state: { stageId: "implement", stateVersion: 2 } });
    const failedSkill = implement.current.requiredSkills[0]!;
    await fixture.db.reportWorkspaceSkillProjection({
      teamId: fixture.actor.teamId, workspaceId: assignment!.workflowSkills!.workspaceId,
      skillId: failedSkill.skillId, desiredGeneration: 2, status: "failed",
      failureCode: "injected_failure", reportedAt: new Date().toISOString(),
    });
    expect(await workload.current(code)).toMatchObject({ state: { stageId: "implement", stateVersion: 2 }, projection: { status: "failed" } });
    for (const skill of implement.current.requiredSkills) {
      await fixture.db.reportWorkspaceSkillProjection({
        teamId: fixture.actor.teamId, workspaceId: assignment!.workflowSkills!.workspaceId,
        skillId: skill.skillId, desiredGeneration: 2, status: "ready", failureCode: null,
        reportedAt: new Date().toISOString(),
      });
    }
    expect(await workload.current(code)).toMatchObject({ projection: { status: "ready" } });

    const sequence = [
      ["implementation-complete", 2], ["verification-failed", 3],
      ["implementation-complete", 4], ["verification-passed", 5],
    ] as const;
    let current = implement.current;
    for (const [actionId, expectedStateVersion] of sequence) {
      current = (await workload.transition(code, { commandId: crypto.randomUUID(), actionId, expectedStateVersion })).current;
    }
    expect(current).toMatchObject({ state: { stageId: "completed", stateVersion: 6, terminal: true }, availableActions: [] });

    const disabled = await management.disable({
      teamId: fixture.actor.teamId, taskId: fixture.task.id, actor,
      request: { commandId: crypto.randomUUID(), expectedStateVersion: 6 },
    });
    expect(disabled.workflow.active).toBe(false);
    await expect(workload.current(code)).rejects.toMatchObject({ code: "capability_expired" });
    const reenabled = await management.enable({
      teamId: fixture.actor.teamId, taskId: fixture.task.id, actor,
      request: { commandId: crypto.randomUUID() },
    });
    expect(reenabled.workflow).toMatchObject({ stageId: "understand", stateVersion: 1, active: true });
    expect(reenabled.workflow.stateId).not.toBe(enabled.workflow.stateId);
    await expect(workload.current(code)).rejects.toMatchObject({ code: "capability_expired" });
    expect(started.executionContext.sessionId).toBe(assignment?.session.id);
  });
});

async function publishFixedSkills(current: NonNullable<typeof fixture>) {
  for (const name of ["repository-development-guide", "idea-refine", "incremental-implementation", "code-review-and-quality"]) {
    const content = Buffer.from(`---\nname: ${name}\ndescription: Fixed Workflow test Skill.\n---\n`);
    const reservation = await current.db.reserveInitialSkillPublication({
      teamId: current.actor.teamId, name, createdByUserId: current.actor.actorId,
      content: {
        description: "Fixed Workflow test Skill.",
        manifest: [{ path: "SKILL.md", sizeBytes: content.length, sha256: "a".repeat(64), mediaType: "text/markdown", previewability: "text" }],
        compressedSizeBytes: 1, uncompressedSizeBytes: content.length,
        zipSha256: "b".repeat(64), contentSha256: "c".repeat(64),
      },
    });
    await current.db.finalizeSkillRevisionPublication({
      teamId: current.actor.teamId, skillId: reservation.skill.id,
      revisionId: reservation.revision.id, expectedResourceRevision: reservation.skill.resourceRevision,
    });
  }
}
