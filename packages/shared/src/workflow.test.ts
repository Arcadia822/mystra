import { describe, expect, it } from "vitest";

import {
  workflowExecutionSnapshotSchema,
  workflowNodeExecutionSnapshotSchema,
} from "./workflow.js";

describe("workflowExecutionSnapshotSchema", () => {
  it("accepts additive workflow inspection snapshots", () => {
    const parsed = workflowExecutionSnapshotSchema.parse({
      provider: "local",
      blueprintName: "mvp.coding",
      blueprintVersion: "1.0.0",
      status: "running",
      currentNodeId: "clone",
      nodeExecutions: [
        {
          nodeId: "clone",
          handler: "git.clone",
          nodeKind: "deterministic",
          status: "running",
          startedAt: "2026-05-14T00:00:00.000Z",
          data: {
            agent: "codex",
          },
        },
      ],
      startedAt: "2026-05-14T00:00:00.000Z",
      updatedAt: "2026-05-14T00:00:00.000Z",
    });

    expect(parsed.currentNodeId).toBe("clone");
    expect(parsed.provider).toBe("local");
    expect(parsed.nodeExecutions).toHaveLength(1);
  });

  it("accepts workflow metadata before the first node event is observed", () => {
    const parsed = workflowExecutionSnapshotSchema.parse({
      provider: "local",
      blueprintName: "mvp.coding",
      blueprintVersion: "1.0.0",
      status: "running",
      nodeExecutions: [],
      startedAt: "2026-05-14T00:00:00.000Z",
      updatedAt: "2026-05-14T00:00:05.000Z",
    });

    expect(parsed.nodeExecutions).toHaveLength(0);
    expect(parsed.blueprintName).toBe("mvp.coding");
  });

  it("accepts terminal node execution snapshots with merged event metadata", () => {
    const parsed = workflowNodeExecutionSnapshotSchema.parse({
      nodeId: "quality_gate",
      handler: "quality_gate.run",
      nodeKind: "deterministic",
      status: "failed",
      startedAt: "2026-05-14T00:00:00.000Z",
      finishedAt: "2026-05-14T00:01:00.000Z",
      data: {
        sequence: ["test", "build"],
        summary: "Quality gate failed",
      },
    });

    expect(parsed.status).toBe("failed");
    expect(parsed.data).toEqual(expect.objectContaining({
      summary: "Quality gate failed",
    }));
  });
});
