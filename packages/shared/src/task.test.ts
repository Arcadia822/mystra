import { describe, expect, it } from "vitest";

import {
  allowedTaskProductionTransitions,
  taskProductionStatusSchema,
  taskStatusTransitionRequestSchema,
  manualTaskCreateRequestSchema,
  taskCreateFromIssueSchema,
  taskIssueReferenceSchema,
  taskSchema,
  taskUpdateRequestSchema,
} from "./task.js";

const projectId = "00000000-0000-4000-8000-000000000001";
const teamId = "00000000-0000-4000-8000-000000000002";
const connectionId = "00000000-0000-4000-8000-000000000003";
const idempotencyKey = "00000000-0000-4000-8000-000000000004";

const issue = {
  provider: "github",
  connectionId,
  scopeExternalId: "R_kgDOFixture",
  externalId: "I_kwDOFixture",
  identifier: "GH-42",
} as const;

describe("Task contracts", () => {
  it("accepts a title-only manual Task request and normalizes optional values", () => {
    expect(manualTaskCreateRequestSchema.parse({
      title: "  Investigate the failure  ",
      idempotencyKey,
    })).toEqual({
      title: "Investigate the failure",
      description: null,
      projectId: null,
      idempotencyKey,
    });
  });

  it("accepts one optional Project and rejects identity, Issue and Session fields", () => {
    expect(manualTaskCreateRequestSchema.parse({
      title: "Implement the fix",
      description: "  Keep this context.  ",
      projectId,
      idempotencyKey,
    }).projectId).toBe(projectId);

    for (const forbidden of [
      { teamId },
      { issue },
      { issueExternalId: issue.externalId },
      { agentId: "00000000-0000-4000-8000-000000000005" },
      { provider: "codex" },
      { branch: "feature/task" },
      { objective: "start a Session" },
    ]) {
      expect(() => manualTaskCreateRequestSchema.parse({
        title: "Strict request",
        idempotencyKey,
        ...forbidden,
      })).toThrow();
    }
  });

  it("models an exact all-or-none Issue reference", () => {
    expect(taskIssueReferenceSchema.parse(issue)).toEqual(issue);
    expect(() => taskIssueReferenceSchema.parse({
      provider: "github",
      connectionId,
      scopeExternalId: issue.scopeExternalId,
      identifier: issue.identifier,
    })).toThrow();
    expect(() => taskIssueReferenceSchema.parse({ ...issue, provider: "jira" })).toThrow();
  });

  it("requires Project context for Issue-derived creation", () => {
    expect(taskCreateFromIssueSchema.parse({
      teamId,
      projectId,
      title: "Issue title",
      description: null,
      issue,
    }).issue.externalId).toBe(issue.externalId);
    expect(() => taskCreateFromIssueSchema.parse({
      teamId,
      projectId: null,
      title: "Issue title",
      issue,
    })).toThrow();
  });

  it("allows only title and description updates and rejects an empty update", () => {
    expect(taskUpdateRequestSchema.parse({ title: "  New title  " })).toEqual({ title: "New title" });
    expect(taskUpdateRequestSchema.parse({ description: null })).toEqual({ description: null });
    expect(() => taskUpdateRequestSchema.parse({})).toThrow();
    expect(() => taskUpdateRequestSchema.parse({ projectId })).toThrow();
    expect(() => taskUpdateRequestSchema.parse({ issue })).toThrow();
  });

  it("enforces text limits and the public Task shape", () => {
    expect(() => manualTaskCreateRequestSchema.parse({
      title: "x".repeat(501),
      idempotencyKey,
    })).toThrow();
    expect(() => manualTaskCreateRequestSchema.parse({
      title: "valid",
      description: "x".repeat(100_001),
      idempotencyKey,
    })).toThrow();

    const parsed = taskSchema.parse({
      id: "00000000-0000-4000-8000-000000000006",
      teamId,
      title: "Issue title",
      description: null,
      projectId,
      issue,
      productionStatus: "pending",
      statusRevision: 1,
      statusNote: null,
      statusUpdatedAt: "2026-08-08T00:00:00.000Z",
      statusActor: { kind: "system", actorId: null, agentId: null, harnessId: null, sessionId: null },
      createdAt: "2026-08-08T00:00:00.000Z",
      updatedAt: "2026-08-08T00:00:00.000Z",
    });
    expect(parsed.issue?.identifier).toBe("GH-42");
    expect("metadata" in parsed).toBe(false);
    expect("issueDispatchKey" in parsed).toBe(false);
    expect(parsed.productionStatus).toBe("pending");
  });

  it("defines the complete Task production state vocabulary", () => {
    expect(taskProductionStatusSchema.options).toEqual([
      "pending",
      "in_progress",
      "blocked",
      "waiting_for_review",
      "done",
      "canceled",
    ]);
  });

  it("keeps Human and Agent production transitions explicit", () => {
    expect(allowedTaskProductionTransitions("agent", "in_progress")).toEqual(["blocked", "waiting_for_review"]);
    expect(allowedTaskProductionTransitions("agent", "blocked")).toEqual(["in_progress"]);
    expect(allowedTaskProductionTransitions("agent", "waiting_for_review")).toEqual([]);
    expect(allowedTaskProductionTransitions("human", "waiting_for_review")).toEqual(["in_progress", "done", "canceled"]);
    expect(allowedTaskProductionTransitions("assign", "pending")).toEqual(["in_progress"]);
    expect(allowedTaskProductionTransitions("human", "pending")).toEqual(["canceled"]);
    expect(allowedTaskProductionTransitions("human", "done")).toEqual([]);
  });

  it("requires notes for blocked and waiting_for_review commands", () => {
    expect(() => taskStatusTransitionRequestSchema.parse({
      status: "blocked",
      expectedRevision: 2,
      idempotencyKey: "cmd-1",
    })).toThrow();
    expect(taskStatusTransitionRequestSchema.parse({
      status: "waiting_for_review",
      expectedRevision: 2,
      idempotencyKey: "cmd-2",
      note: " PR: https://example.test/pr/1 ",
    }).note).toBe("PR: https://example.test/pr/1");
    expect(taskStatusTransitionRequestSchema.parse({
      status: "in_progress",
      expectedRevision: 3,
      idempotencyKey: "cmd-3",
    }).note).toBeUndefined();
  });
});
