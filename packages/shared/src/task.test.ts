import { describe, expect, it } from "vitest";

import {
  allowedTaskStatusTransitions,
  taskStatusSchema,
  taskStatusTransitionRequestSchema,
  manualTaskCreateRequestSchema,
  taskCreateFromIssueSchema,
  taskIssueReferenceSchema,
  taskSchema,
  taskPageQuerySchema,
  taskWorkbenchPageSchema,
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
      metadata: {},
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
      { runtimeId: "00000000-0000-4000-8000-000000000006" },
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

  it("allows title, description, and full metadata replacement and rejects an empty update", () => {
    expect(taskUpdateRequestSchema.parse({ title: "  New title  " })).toEqual({ title: "New title" });
    expect(taskUpdateRequestSchema.parse({ description: null })).toEqual({ description: null });
    expect(taskUpdateRequestSchema.parse({ metadata: { priority: "high", nested: { count: 2 } } })).toEqual({
      metadata: { priority: "high", nested: { count: 2 } },
    });
    expect(() => taskUpdateRequestSchema.parse({})).toThrow();
    expect(() => taskUpdateRequestSchema.parse({ projectId })).toThrow();
    expect(() => taskUpdateRequestSchema.parse({ issue })).toThrow();
    expect(() => taskUpdateRequestSchema.parse({ runtimeId: "00000000-0000-4000-8000-000000000006" })).toThrow();
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
      status: "pending",
      metadata: { priority: "high", score: 2, nested: { enabled: true } },
      runtimeId: null,
      statusRevision: 1,
      statusNote: null,
      statusUpdatedAt: "2026-08-08T00:00:00.000Z",
      statusActor: { kind: "system", actorId: null, agentId: null, attemptId: null, sessionId: null },
      createdAt: "2026-08-08T00:00:00.000Z",
      updatedAt: "2026-08-08T00:00:00.000Z",
    });
    expect(parsed.issue?.identifier).toBe("GH-42");
    expect(parsed.metadata).toEqual({ priority: "high", score: 2, nested: { enabled: true } });
    expect(parsed.runtimeId).toBeNull();
    expect("issueDispatchKey" in parsed).toBe(false);
    expect(parsed.status).toBe("pending");
    expect("productionStatus" in parsed).toBe(false);
  });

  it("defines the complete five-state Task vocabulary", () => {
    expect(taskStatusSchema.options).toEqual([
      "pending",
      "in_progress",
      "blocked",
      "done",
      "canceled",
    ]);
  });

  it("keeps Human and Agent production transitions explicit", () => {
    expect(allowedTaskStatusTransitions("agent", "in_progress")).toEqual(["blocked"]);
    expect(allowedTaskStatusTransitions("agent", "blocked")).toEqual(["in_progress"]);
    expect(allowedTaskStatusTransitions("human", "blocked")).toEqual(["in_progress", "done", "canceled"]);
    expect(allowedTaskStatusTransitions("assign", "pending")).toEqual(["in_progress"]);
    expect(allowedTaskStatusTransitions("human", "pending")).toEqual(["canceled"]);
    expect(allowedTaskStatusTransitions("human", "done")).toEqual([]);
  });

  it("requires notes for blocked commands and rejects waiting_for_review", () => {
    expect(() => taskStatusTransitionRequestSchema.parse({
      status: "blocked",
      expectedRevision: 2,
      idempotencyKey: "cmd-1",
    })).toThrow();
    expect(() => taskStatusTransitionRequestSchema.parse({
      status: "waiting_for_review",
      expectedRevision: 2,
      idempotencyKey: "cmd-2",
      note: " PR: https://example.test/pr/1 ",
    })).toThrow();
    expect(taskStatusTransitionRequestSchema.parse({
      status: "in_progress",
      expectedRevision: 3,
      idempotencyKey: "cmd-3",
    }).note).toBeUndefined();
  });

  it("parses a bounded Task page query and rejects unsupported sort/status values", () => {
    expect(taskPageQuerySchema.parse({})).toEqual({
      limit: 50,
      query: null,
      statuses: [],
      sort: "updatedAt",
      direction: "desc",
      cursor: null,
    });
    expect(taskPageQuerySchema.parse({
      limit: 100,
      query: "  PRIORITY  ",
      statuses: ["blocked", "pending"],
      sort: "title",
      direction: "asc",
    }).query).toBe("PRIORITY");
    expect(() => taskPageQuerySchema.parse({ limit: 101 })).toThrow();
    expect(() => taskPageQuerySchema.parse({ statuses: ["waiting_for_review"] })).toThrow();
    expect(() => taskPageQuerySchema.parse({ sort: "productionStatus" })).toThrow();
  });

  it("keeps metadata inside each Task workbench item", () => {
    const task = taskSchema.parse({
      id: "00000000-0000-4000-8000-000000000006",
      teamId,
      title: "Task",
      description: null,
      projectId: null,
      issue: null,
      status: "pending",
      metadata: { priority: "P1" },
      runtimeId: "00000000-0000-4000-8000-000000000007",
      statusRevision: 1,
      statusNote: null,
      statusUpdatedAt: "2026-08-08T00:00:00.000Z",
      statusActor: { kind: "system", actorId: null, agentId: null, attemptId: null, sessionId: null },
      createdAt: "2026-08-08T00:00:00.000Z",
      updatedAt: "2026-08-08T00:00:00.000Z",
    });
    const page = taskWorkbenchPageSchema.parse({
      items: [{ ...task, projectReference: null }],
      nextCursor: null,
    });
    expect(page.items[0]?.metadata).toEqual({ priority: "P1" });
    expect(page.items[0]?.runtimeId).toBe("00000000-0000-4000-8000-000000000007");
    expect("labels" in page).toBe(false);
  });
});
