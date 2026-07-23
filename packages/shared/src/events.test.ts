import { describe, expect, it } from "vitest";

import {
  controlPlaneLifecycleHandoffEventTypes,
  runEventSchema,
  runEventTypeSchema,
  terminalRunEventTypes,
} from "./events.js";

describe("runEventSchema", () => {
  it("accepts structured events without raw log offsets", () => {
    const parsed = runEventSchema.parse({
      runId: "550e8400-e29b-41d4-a716-446655440000",
      jobId: "550e8400-e29b-41d4-a716-446655440001",
      timestamp: "2026-04-30T00:00:00.000Z",
      type: "container.started",
      severity: "info",
      data: { containerId: "abc123" },
    });

    expect(parsed.type).toBe("container.started");
    expect(parsed.data).toEqual({ containerId: "abc123" });
  });

  it("rejects raw agent log events because logs are not in MVP", () => {
    expect(() =>
      runEventSchema.parse({
        runId: "550e8400-e29b-41d4-a716-446655440000",
        jobId: "550e8400-e29b-41d4-a716-446655440001",
        timestamp: "2026-04-30T00:00:00.000Z",
        type: "agent.log",
        severity: "info",
        data: { content: "hello" },
      }),
    ).toThrow();
  });

  it("accepts separate deterministic test and build lifecycle events", () => {
    const parsed = runEventSchema.parse({
      runId: "550e8400-e29b-41d4-a716-446655440000",
      jobId: "550e8400-e29b-41d4-a716-446655440001",
      timestamp: "2026-04-30T00:00:00.000Z",
      type: "quality.test.failed",
      severity: "error",
      data: {
        command: "pnpm test",
        durationMs: 1200,
        exitCode: 1,
        logPath: "/mystra/workspace/quality-gate.log",
      },
    });

    expect(parsed.type).toBe("quality.test.failed");
  });

  it("rejects workflow-specific lifecycle events", () => {
    expect(() => runEventSchema.parse({
      runId: "550e8400-e29b-41d4-a716-446655440000",
      jobId: "550e8400-e29b-41d4-a716-446655440001",
      timestamp: "2026-04-30T00:00:00.000Z",
      type: "workflow.node.failed",
      severity: "error",
      data: { nodeId: "quality_gate" },
    })).toThrow();
  });

  it("accepts direct execution, clone, agent, preview and review reuse facts", () => {
    for (const type of [
      "execution.started",
      "repository.clone.started",
      "repository.clone.succeeded",
      "agent.succeeded",
      "quality.build.passed",
      "preview.ready",
      "review.reused",
      "run.waiting_for_review",
    ] as const) {
      expect(runEventTypeSchema.parse(type)).toBe(type);
    }
  });

  it("accepts provider-neutral review creation events", () => {
    const parsed = runEventSchema.parse({
      runId: "550e8400-e29b-41d4-a716-446655440000",
      jobId: "550e8400-e29b-41d4-a716-446655440001",
      timestamp: "2026-04-30T00:00:00.000Z",
      type: "review.created",
      severity: "info",
      data: {
        provider: "gitlab",
        reviewUrl: "https://gitlab.example.com/group/project/-/merge_requests/7",
        reviewNumber: 7,
        displayId: "!7",
      },
    });

    expect(parsed.type).toBe("review.created");
    expect(parsed.data).toEqual(expect.objectContaining({
      provider: "gitlab",
      displayId: "!7",
    }));
  });

  it("exports control-plane handoff and terminal event vocabularies from the shared lifecycle schema", () => {
    expect(controlPlaneLifecycleHandoffEventTypes.map((type) => runEventTypeSchema.parse(type))).toEqual([
      "job.created",
      "run.queued",
      "run.assigned",
    ]);
    expect(terminalRunEventTypes.map((type) => runEventTypeSchema.parse(type))).toEqual([
      "run.succeeded",
      "run.failed",
      "run.canceled",
      "run.timed_out",
      "run.waiting_for_review",
    ]);
  });
});
