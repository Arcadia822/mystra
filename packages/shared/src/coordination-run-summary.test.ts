import { describe, expect, it } from "vitest";

import {
  coordinationRunSummaryPayloadSchema,
  coordinationRunSummarySchema,
} from "./coordination-run-summary.js";

const jobId = "11111111-1111-4111-8111-111111111111";
const runId = "22222222-2222-4222-8222-222222222222";

describe("coordinationRunSummarySchema", () => {
  it("accepts queued summaries with a wrapped payload", () => {
    const parsed = coordinationRunSummaryPayloadSchema.parse({
      summary: {
        jobId,
        runId,
        attempt: 1,
        taskId: "TASK-1",
        runState: "queued",
        phase: "queued",
        headline: "Waiting for runner assignment",
        milestone: {
          key: "queued",
          label: "Queued",
          observedAt: "2026-05-17T00:00:00.000Z",
        },
        sourceEventType: "run.state",
        updatedAt: "2026-05-17T00:00:00.000Z",
      },
    });

    expect(parsed.summary.phase).toBe("queued");
    expect(parsed.summary.links).toEqual({});
  });

  it("accepts assigned and running summaries without terminal details", () => {
    const assigned = coordinationRunSummarySchema.parse({
      jobId,
      runId,
      attempt: 2,
      taskId: "TASK-2",
      runState: "starting",
      phase: "assigned",
      headline: "Runner has started preparing the run",
      milestone: {
        key: "runner_assigned",
        label: "Runner assigned",
        observedAt: "2026-05-17T00:00:10.000Z",
      },
      sourceEventType: "run.assigned",
      startedAt: "2026-05-17T00:00:10.000Z",
      updatedAt: "2026-05-17T00:00:10.000Z",
    });
    const running = coordinationRunSummarySchema.parse({
      jobId,
      runId,
      attempt: 2,
      taskId: "TASK-2",
      runState: "running",
      phase: "running",
      headline: "Workflow is executing",
      milestone: {
        key: "workflow_running",
        label: "Workflow running",
        observedAt: "2026-05-17T00:00:20.000Z",
      },
      sourceEventType: "workflow.node.started",
      startedAt: "2026-05-17T00:00:10.000Z",
      updatedAt: "2026-05-17T00:00:20.000Z",
      currentNodeId: "agent.execute",
      links: {
        branch: "mystra/TASK-2",
      },
    });

    expect(assigned.phase).toBe("assigned");
    expect(running.currentNodeId).toBe("agent.execute");
  });

  it("accepts review-ready summaries before terminal completion", () => {
    const parsed = coordinationRunSummarySchema.parse({
      jobId,
      runId,
      attempt: 3,
      taskId: "TASK-3",
      runState: "running",
      phase: "review_ready",
      headline: "Review artifact is ready while the run is still wrapping up",
      milestone: {
        key: "review_created",
        label: "Review created",
        observedAt: "2026-05-17T00:01:00.000Z",
      },
      sourceEventType: "review.created",
      startedAt: "2026-05-17T00:00:10.000Z",
      updatedAt: "2026-05-17T00:01:00.000Z",
      currentNodeId: "review.create",
      links: {
        branch: "mystra/TASK-3",
        reviewUrl: "https://github.com/acme/project/pull/3",
        reviewDisplayId: "#3",
      },
    });

    expect(parsed.phase).toBe("review_ready");
    expect(parsed.links.reviewDisplayId).toBe("#3");
  });

  it("accepts terminal summaries with attempt and links", () => {
    const parsed = coordinationRunSummarySchema.parse({
      jobId,
      runId,
      attempt: 4,
      taskId: "TASK-4",
      projectSlug: "local-fixture",
      runState: "succeeded",
      phase: "terminal",
      headline: "Created the requested pull request",
      milestone: {
        key: "terminal",
        label: "Completed",
        observedAt: "2026-05-17T00:02:00.000Z",
      },
      sourceEventType: "run.result",
      startedAt: "2026-05-17T00:00:10.000Z",
      finishedAt: "2026-05-17T00:02:00.000Z",
      updatedAt: "2026-05-17T00:02:00.000Z",
      terminal: {
        status: "succeeded",
        summary: "Created the requested pull request",
      },
      links: {
        branch: "mystra/TASK-4",
        reviewUrl: "https://github.com/acme/project/pull/4",
        reviewDisplayId: "#4",
      },
    });

    expect(parsed.attempt).toBe(4);
    expect(parsed.terminal?.status).toBe("succeeded");
  });

  it("rejects incompatible phase and terminal combinations", () => {
    expect(() => coordinationRunSummarySchema.parse({
      jobId,
      runId,
      attempt: 1,
      taskId: "TASK-5",
      runState: "failed",
      phase: "running",
      headline: "This should not validate",
      milestone: {
        key: "workflow_running",
        label: "Workflow running",
        observedAt: "2026-05-17T00:03:00.000Z",
      },
      sourceEventType: "workflow.started",
      finishedAt: "2026-05-17T00:03:00.000Z",
      updatedAt: "2026-05-17T00:03:00.000Z",
      terminal: {
        status: "failed",
        summary: "Should only exist on terminal summaries",
      },
    })).toThrow(/phase running is incompatible with runState failed/);
  });
});
