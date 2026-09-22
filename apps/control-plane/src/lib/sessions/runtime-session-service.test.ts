import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type { SessionEventAppendInput } from "../db/rdb-provider";

import { RuntimeSessionService } from "./runtime-session-service";

const timestamp = "2026-08-10T00:00:00.000Z";
const sessionId = "00000000-0000-4000-8000-000000000001";
const teamId = "00000000-0000-4000-8000-000000000002";
const taskId = "00000000-0000-4000-8000-000000000003";
const runtimeId = "00000000-0000-4000-8000-000000000004";
const agentId = "00000000-0000-4000-8000-000000000005";
const messageId = "00000000-0000-4000-8000-000000000006";

function claimedSession() {
  return {
    id: sessionId, teamId, taskId, projectId: null, runtimeId, providerKey: "codex",
    agentId, agentRevision: 1, state: "dispatched" as const, activeMessageId: messageId,
    lastMessageId: null, interruptKind: null, continuationMode: null, failureCode: null,
    metadata: {}, createdAt: timestamp, updatedAt: timestamp,
  };
}

describe("RuntimeSessionService claim and event ingest", () => {
  it("claims the active message and returns only the raw lease token", async () => {
    const leaseToken = "l".repeat(32);
    const session = claimedSession();
    const db = {
      claimSession: vi.fn(async (input: { lease: { leaseToken: string } }) => ({
        session,
        launchRequest: {},
        lease: {
          id: "00000000-0000-4000-8000-000000000007",
          sessionId,
          runtimeId,
          runnerId: "runner-1",
          leaseToken: input.lease.leaseToken,
          providerSessionId: null,
          leaseExpiresAt: "2026-08-10T07:00:00.000Z",
          claimedAt: timestamp,
          updatedAt: timestamp,
        },
        executionCodeExpiresAt: "2026-08-10T03:00:00.000Z",
      })),
      listSessionEvents: vi.fn(async () => ({ events: [
        { kind: "session.system_prompt_configured", payload: {
          standardPrompt: { version: `sha256:${"a".repeat(64)}`, content: "Standard" },
          agentContext: { agentId, name: "Agent", revision: 1, systemPrompt: "Supplemental" },
          components: [
            { name: "standard", content: "Standard" },
            { name: "runtime", content: "Runtime" },
            { name: "runtime_workload", content: "Runtime workload" },
            { name: "provider", content: "Provider" },
            { name: "agent_context", content: "Supplemental" },
            { name: "execution_context", content: "Context" },
          ],
          finalPrompt: "Frozen prompt",
        } },
        { kind: "session.workspace_attached", payload: { kind: "task", taskWorkspaceId: "00000000-0000-4000-8000-000000000008", runtimeId, workspaceRef: "host-task-workspace:00000000-0000-4000-8000-000000000008", sharingMode: "shared-mutable" } },
        { kind: "session.user_message_submitted", messageId, payload: { content: [{ type: "text", text: "Execute" }] } },
      ] })),
      appendSessionEvents: vi.fn(), updateSessionLeaseProviderId: vi.fn(),
      listExpiredSessionLeases: vi.fn(), getSession: vi.fn(),
      getSessionWorkflowCapability: vi.fn(async () => undefined), getTaskWorkflowState: vi.fn(),
      listWorkspaceSkillProjections: vi.fn(), getSkillRevisionRecord: vi.fn(),
    };
    const service = new RuntimeSessionService({
      db: db as never,
      now: () => new Date("2026-08-10T01:00:00.000Z"),
      newId: () => "00000000-0000-4000-8000-000000000007",
      newToken: () => leaseToken,
      newExecutionCode: () => "execution-code-value-which-is-long-enough",
    });

    const assignment = await service.claim({ runtimeId, request: { runnerId: "runner-1", waitSeconds: 0 } });
    expect(assignment).toMatchObject({
      session: { id: sessionId },
      message: { messageId },
      systemPrompt: "Frozen prompt",
      lease: { leaseToken },
      execution: { code: "execution-code-value-which-is-long-enough" },
    });
    expect(JSON.stringify(assignment)).not.toContain("leaseTokenHash");
    expect(db.claimSession).toHaveBeenCalledWith(expect.objectContaining({
      runtimeId,
      runnerId: "runner-1",
      lease: expect.objectContaining({
        leaseToken,
        leaseTokenHash: createHash("sha256").update(leaseToken).digest("hex"),
        executionCodeHash: createHash("sha256").update("execution-code-value-which-is-long-enough").digest("hex"),
        executionCodeExpiresAt: "2026-08-10T07:00:00.000Z",
      }),
    }));
    expect(JSON.stringify(db.claimSession.mock.calls[0]![0])).not.toContain("execution-code-value-which-is-long-enough");
    expect(assignment).not.toHaveProperty("workflowSkills");
    expect(assignment?.execution?.capabilities).toEqual(["context:read", "task-status:read", "task-status:transition"]);
  });

  it("adds exact Workflow capabilities and desired Skill revisions only for an active Session binding", async () => {
    const leaseToken = "l".repeat(32);
    const workflowStateId = "00000000-0000-4000-8000-000000000030";
    const skillId = "00000000-0000-4000-8000-000000000031";
    const revisionId = "00000000-0000-4000-8000-000000000032";
    const workspaceId = "00000000-0000-4000-8000-000000000008";
    const db = {
      claimSession: vi.fn(async (input: { lease: { leaseToken: string } }) => ({
        session: claimedSession(), launchRequest: {},
        lease: {
          id: "00000000-0000-4000-8000-000000000007", sessionId, runtimeId,
          runnerId: "runner-1", leaseToken: input.lease.leaseToken, providerSessionId: null,
          leaseExpiresAt: "2026-08-10T07:00:00.000Z", claimedAt: timestamp, updatedAt: timestamp,
        },
        executionCodeExpiresAt: "2026-08-10T03:00:00.000Z",
      })),
      listSessionEvents: vi.fn(async () => ({ events: [
        { kind: "session.system_prompt_configured", payload: {
          standardPrompt: { version: `sha256:${"a".repeat(64)}`, content: "Standard" }, agentContext: null,
          components: [
            { name: "standard", content: "Standard" }, { name: "runtime", content: "Runtime" },
            { name: "runtime_workload", content: "Runtime workload" },
            { name: "provider", content: "Provider" }, { name: "workflow", content: "Workflow" },
            { name: "execution_context", content: "Context" },
          ], finalPrompt: "Frozen prompt",
        } },
        { kind: "session.workspace_attached", payload: { kind: "task", taskWorkspaceId: workspaceId, runtimeId, workspaceRef: `host-task-workspace:${workspaceId}`, sharingMode: "shared-mutable" } },
        { kind: "session.user_message_submitted", messageId, payload: { content: [{ type: "text", text: "Execute" }] } },
      ] })),
      getSessionWorkflowCapability: vi.fn(async () => ({ sessionId, workflowStateId, teamId, taskId, issuedAt: timestamp, revokedAt: null })),
      getTaskWorkflowState: vi.fn(async () => ({
        id: workflowStateId, teamId, taskId, workflowId: "mystra.workflow", stageId: "understand",
        stateVersion: 1, activeKey: "mystra.workflow", enabledByUserId: agentId,
        enableCommandId: messageId, enabledAt: timestamp, disabledByUserId: null,
        disableCommandId: null, disabledAt: null, updatedAt: timestamp,
      })),
      listWorkspaceSkillProjections: vi.fn(async () => [{
        workspaceId, skillId, skillRevisionId: revisionId, relativePath: `.mystra/skills/${skillId}`,
        desiredGeneration: 1, appliedGeneration: null, status: "pending", failureCode: null, updatedAt: timestamp,
      }]),
      getSkillRevisionRecord: vi.fn(async () => ({
        id: revisionId, skillId, baseRevisionId: null, sequence: 1, publicationStatus: "ready",
        description: "Workflow skill", manifest: [{ path: "SKILL.md", sizeBytes: 4, sha256: "a".repeat(64), mediaType: "text/markdown", previewability: "text" }],
        compressedSizeBytes: 10, uncompressedSizeBytes: 4, zipSha256: "b".repeat(64), contentSha256: "c".repeat(64),
        objectKey: "must-not-leak", createdByUserId: agentId, createdAt: timestamp, readyAt: timestamp,
        failedAt: null, failureCode: null,
      })),
      appendSessionEvents: vi.fn(), updateSessionLeaseProviderId: vi.fn(), listExpiredSessionLeases: vi.fn(), getSession: vi.fn(),
    };
    const service = new RuntimeSessionService({
      db: db as never, now: () => new Date("2026-08-10T01:00:00.000Z"),
      newId: () => "00000000-0000-4000-8000-000000000007", newToken: () => leaseToken,
      newExecutionCode: () => "execution-code-value-which-is-long-enough",
    });

    const assignment = await service.claim({ runtimeId, request: { runnerId: "runner-1", waitSeconds: 0 } });
    expect(assignment?.execution?.capabilities).toEqual([
      "context:read", "task-status:read", "task-status:transition",
      "workflow:read", "workflow:transition", "workflow:projection:read", "workflow:projection:report",
    ]);
    expect(assignment?.workflowSkills).toMatchObject({
      workspaceId, generation: 1,
      entries: [{ skillId, revisionId, relativePath: `.mystra/skills/${skillId}` }],
    });
    expect(JSON.stringify(assignment)).not.toContain("must-not-leak");
  });

  it("requires the same lease token in header/body and hashes it before persistence", async () => {
    const leaseToken = "l".repeat(32);
    const appendSessionEvents = vi.fn(async () => ({ session: claimedSession(), events: [] }));
    const service = new RuntimeSessionService({
      db: {
        claimSession: vi.fn(), listSessionEvents: vi.fn(), appendSessionEvents,
        updateSessionLeaseProviderId: vi.fn(), listExpiredSessionLeases: vi.fn(), getSession: vi.fn(),
        getSessionWorkflowCapability: vi.fn(), getTaskWorkflowState: vi.fn(),
        listWorkspaceSkillProjections: vi.fn(), getSkillRevisionRecord: vi.fn(),
      },
    });
    const batch = {
      leaseToken,
      events: [{
        eventId: "00000000-0000-4000-8000-000000000009",
        sessionId,
        sourceId: "runner-1:message-1",
        sourceSequence: 1,
        kind: "session.response_started",
        version: 1,
        messageId,
        payload: {},
        metadata: {},
        occurredAt: timestamp,
      }],
    };
    await expect(service.appendEvents({
      sessionId, teamId, leaseToken: "x".repeat(32), batch,
    })).rejects.toMatchObject({ code: "lease_invalid" });
    await service.appendEvents({ sessionId, teamId, leaseToken, batch });
    expect(appendSessionEvents).toHaveBeenCalledWith(expect.objectContaining({
      sessionId,
      teamId,
      leaseTokenHash: createHash("sha256").update(leaseToken).digest("hex"),
    }));
  });
});

describe("RuntimeSessionService lease reconciliation", () => {
  it("fails an active Session only after its lease expires and Runtime is offline", async () => {
    const session = {
      id: "00000000-0000-4000-8000-000000000001", teamId: "00000000-0000-4000-8000-000000000002",
      taskId: "00000000-0000-4000-8000-000000000003", projectId: null,
      runtimeId: "00000000-0000-4000-8000-000000000004", providerKey: "codex",
      agentId: "00000000-0000-4000-8000-000000000005", agentRevision: 1,
      state: "running" as const, activeMessageId: "00000000-0000-4000-8000-000000000006",
      lastMessageId: null, interruptKind: null, continuationMode: null, failureCode: null, metadata: {},
      createdAt: "2026-08-10T00:00:00.000Z", updatedAt: "2026-08-10T00:00:00.000Z",
    };
    const appendSessionEvents = vi.fn(async (_input: SessionEventAppendInput) => ({ session: { ...session, state: "failed" as const }, events: [] }));
    const db = {
      claimSession: vi.fn(), listSessionEvents: vi.fn(), updateSessionLeaseProviderId: vi.fn(),
      listExpiredSessionLeases: vi.fn(async () => [{
        id: "00000000-0000-4000-8000-000000000007", sessionId: session.id,
        runtimeId: session.runtimeId, runnerId: "runner-1", teamId: session.teamId,
        leaseExpiresAt: "2026-08-10T00:00:00.000Z",
      }]),
      getSession: vi.fn(async () => session),
      appendSessionEvents,
      getSessionWorkflowCapability: vi.fn(), getTaskWorkflowState: vi.fn(),
      listWorkspaceSkillProjections: vi.fn(), getSkillRevisionRecord: vi.fn(),
    };
    const service = new RuntimeSessionService({ db, now: () => new Date("2026-08-10T01:00:00.000Z") });
    await expect(service.reconcileExpiredLeases(async () => false)).resolves.toBe(1);
    expect(appendSessionEvents.mock.calls[0]![0].events[0]).toMatchObject({
      kind: "session.runtime_lost",
      payload: { code: "runtime_lost" },
    });
  });

  it("keeps an expired lease when its Runtime is still online", async () => {
    const appendSessionEvents = vi.fn();
    const service = new RuntimeSessionService({
      db: {
        claimSession: vi.fn(), listSessionEvents: vi.fn(), updateSessionLeaseProviderId: vi.fn(),
        listExpiredSessionLeases: vi.fn(async () => [{
          id: "00000000-0000-4000-8000-000000000007",
          sessionId,
          runtimeId,
          runnerId: "runner-1",
          teamId,
          leaseExpiresAt: timestamp,
        }]),
        getSession: vi.fn(),
        appendSessionEvents,
        getSessionWorkflowCapability: vi.fn(), getTaskWorkflowState: vi.fn(),
        listWorkspaceSkillProjections: vi.fn(), getSkillRevisionRecord: vi.fn(),
      },
      now: () => new Date("2026-08-10T01:00:00.000Z"),
    });
    await expect(service.reconcileExpiredLeases(async () => true)).resolves.toBe(0);
    expect(appendSessionEvents).not.toHaveBeenCalled();
  });
});
