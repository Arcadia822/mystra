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

  it("accepts normalized review and sandbox outcomes beside transitional GitLab fields", () => {
    const parsed = runResultSchema.parse({
      status: "succeeded",
      summary: "Created the requested review and kept the preview container alive",
      branch: "feature/task-2",
      mrUrl: "https://gitlab.example.com/group/project/-/merge_requests/9",
      mrIid: 9,
      reviewResult: {
        status: "review_created",
        branch: {
          status: "pushed",
          branchName: "feature/task-2",
          branchUrl: "https://gitlab.example.com/group/project/-/tree/feature/task-2",
        },
        review: {
          provider: "gitlab",
          url: "https://gitlab.example.com/group/project/-/merge_requests/9",
          number: 9,
          displayId: "!9",
        },
        metadata: {},
      },
      sandboxOutcome: {
        status: "succeeded",
        session: {
          provider: "docker",
          sessionId: "container-9",
          status: "retained",
          startedAt: "2026-05-14T00:00:00.000Z",
          finishedAt: "2026-05-14T00:05:00.000Z",
          retained: true,
        },
        ports: [
          {
            name: "frontend",
            containerPort: 3000,
            hostBinding: "0.0.0.0:41009",
            url: "http://127.0.0.1:41009",
            reachable: true,
          },
        ],
        cleanup: {
          status: "skipped",
          attemptedAt: "2026-05-14T00:05:00.000Z",
        },
        metadata: {},
      },
    });

    expect(parsed.reviewResult?.review?.displayId).toBe("!9");
    expect(parsed.sandboxOutcome?.session.status).toBe("retained");
  });
});
