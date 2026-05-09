import { describe, expect, it } from "vitest";

import { runResultSchema } from "./result.js";

describe("runResultSchema", () => {
  it("accepts successful GitLab MR metadata", () => {
    const parsed = runResultSchema.parse({
      status: "succeeded",
      summary: "Created the requested MR",
      branch: "feature/task-1",
      mrUrl: "https://gitlab.example.com/group/project/-/merge_requests/7",
      mrIid: 7,
    });

    expect(parsed.status).toBe("succeeded");
    expect(parsed.mrIid).toBe(7);
  });

  it("accepts structured failures", () => {
    const parsed = runResultSchema.parse({
      status: "failed",
      summary: "Push rejected",
      errorCode: "git_push_rejected",
      errorMessage: "The task-provided branch already exists",
    });

    expect(parsed.errorCode).toBe("git_push_rejected");
  });

  it("accepts quality-gate failure metadata without requiring logs persistence", () => {
    const parsed = runResultSchema.parse({
      status: "failed",
      summary: "Quality gate failed during test -> build. See quality-gate.log in the retained workspace.",
      branch: "mystra/task-1",
      errorCode: "quality_gate_failed",
      errorMessage: "Quality gate failed during test -> build. See quality-gate.log in the retained workspace.",
      metadata: {
        qualityGate: {
          status: "failed",
          sequence: ["test", "build"],
          logPath: "/mystra/workspace/quality-gate.log",
        },
      },
    });

    expect(parsed.metadata?.qualityGate).toEqual({
      status: "failed",
      sequence: ["test", "build"],
      logPath: "/mystra/workspace/quality-gate.log",
    });
  });
});
