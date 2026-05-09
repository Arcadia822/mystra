import { describe, expect, it } from "vitest";

import { runEventSchema } from "./events.js";

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
});
