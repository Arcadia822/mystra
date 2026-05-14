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

  it("accepts deterministic quality-gate lifecycle events", () => {
    const parsed = runEventSchema.parse({
      runId: "550e8400-e29b-41d4-a716-446655440000",
      jobId: "550e8400-e29b-41d4-a716-446655440001",
      timestamp: "2026-04-30T00:00:00.000Z",
      type: "quality_gate.failed",
      severity: "error",
      data: {
        sequence: ["test", "build"],
        logPath: "/mystra/workspace/quality-gate.log",
      },
    });

    expect(parsed.type).toBe("quality_gate.failed");
  });

  it("accepts workflow node lifecycle events with structured node metadata", () => {
    const parsed = runEventSchema.parse({
      runId: "550e8400-e29b-41d4-a716-446655440000",
      jobId: "550e8400-e29b-41d4-a716-446655440001",
      timestamp: "2026-04-30T00:00:00.000Z",
      type: "workflow.node.failed",
      severity: "error",
      data: {
        nodeId: "quality_gate",
        handler: "quality_gate.run",
        nodeKind: "deterministic",
        summary: "Quality gate failed during test -> build",
      },
    });

    expect(parsed.type).toBe("workflow.node.failed");
    expect(parsed.data).toEqual(expect.objectContaining({
      nodeId: "quality_gate",
      handler: "quality_gate.run",
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
      "run.needs_human_review",
    ]);
  });
});
