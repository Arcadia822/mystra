import { describe, expect, it } from "vitest";

import {
  agentExecutionMetadataSchema,
  qualityResultSchema,
  reviewHandoffSchema,
  sessionResultSchema,
} from "./result.js";

const waitingForReviewHandoff = {
  issue: {
    integration: "linear",
    provider: "linear",
    externalId: "issue-id",
    identifier: "ENG-123",
    url: "https://linear.app/example/issue/ENG-123/example",
  },
  branch: "codex/eng-123",
  commitSha: "0123456789abcdef",
  reviewResult: {
    status: "review_created",
    branch: {
      status: "pushed",
      branchName: "codex/eng-123",
      branchUrl: "https://github.com/acme/project/tree/codex%2Feng-123",
      commitSha: "0123456789abcdef",
    },
    review: {
      provider: "github",
      url: "https://github.com/acme/project/pull/12",
      number: 12,
      displayId: "#12",
    },
    metadata: {},
  },
  quality: {
    test: {
      status: "passed",
      command: "pnpm test",
      durationMs: 1000,
    },
    build: {
      status: "passed",
      command: "pnpm build",
      durationMs: 2000,
    },
    logPath: "/workspace/quality.log",
  },
  preview: {
    url: "http://127.0.0.1:41009",
    containerName: "mystra-run-1",
    probeCount: 2,
  },
  sandboxOutcome: {
    status: "succeeded",
    session: {
      provider: "docker",
      sessionId: "container-9",
      status: "retained",
      startedAt: "2026-07-23T00:00:00.000Z",
      finishedAt: "2026-07-23T00:05:00.000Z",
      retained: true,
    },
    ports: [
      {
        name: "preview",
        containerPort: 3000,
        hostBinding: "127.0.0.1:41009",
        url: "http://127.0.0.1:41009",
        reachable: true,
      },
    ],
    cleanup: {
      status: "skipped",
      attemptedAt: "2026-07-23T00:05:00.000Z",
    },
    metadata: {},
  },
  agentExecution: {
    provider: "copilot",
    cliVersion: "1.0.69-0",
    mode: "autopilot",
    maxAutopilotContinues: 10,
    exitCode: 0,
    changedFiles: ["src/health.ts"],
  },
};

describe("sessionResultSchema", () => {
  it("accepts structured quality and bounded Agent execution metadata", () => {
    expect(qualityResultSchema.parse(waitingForReviewHandoff.quality).build?.status).toBe("passed");
    expect(agentExecutionMetadataSchema.parse(waitingForReviewHandoff.agentExecution)).toEqual(
      waitingForReviewHandoff.agentExecution,
    );
    expect(() => agentExecutionMetadataSchema.parse({
      ...waitingForReviewHandoff.agentExecution,
      maxAutopilotContinues: 0,
    })).toThrow();
  });

  it("accepts a complete retained Review handoff", () => {
    expect(reviewHandoffSchema.parse(waitingForReviewHandoff).preview.probeCount).toBe(2);
  });

  it("requires the full handoff for waiting_for_review", () => {
    const parsed = sessionResultSchema.parse({
      status: "waiting_for_review",
      summary: "Ready for human review",
      ...waitingForReviewHandoff,
    });

    expect(parsed.status).toBe("waiting_for_review");
    expect(parsed.issue?.identifier).toBe("ENG-123");

    expect(() => sessionResultSchema.parse({
      status: "waiting_for_review",
      summary: "Claims review readiness without evidence",
    })).toThrow();
  });

  it("rejects transitional merge-request aliases", () => {
    // legacy-term-audit: allow -- negative compatibility assertion only.
    expect(() => sessionResultSchema.parse({
      status: "succeeded",
      summary: "Created the requested MR",
      branch: "feature/task-1",
      mrUrl: "https://gitlab.example.com/group/project/-/merge_requests/7",
      mrIid: 7,
    })).toThrow();
  });

  it("accepts structured failures", () => {
    const parsed = sessionResultSchema.parse({
      status: "failed",
      summary: "Push rejected",
      errorCode: "git_push_rejected",
      errorMessage: "The task-provided branch already exists",
    });

    expect(parsed.errorCode).toBe("git_push_rejected");
  });

  it("accepts quality-gate failure metadata without requiring logs persistence", () => {
    const parsed = sessionResultSchema.parse({
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

  it("accepts normalized review and sandbox outcomes", () => {
    const parsed = sessionResultSchema.parse({
      status: "succeeded",
      summary: "Created the requested review and kept the preview container alive",
      branch: "feature/task-2",
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

  it("accepts normalized GitHub review results without aliases", () => {
    const parsed = sessionResultSchema.parse({
      status: "succeeded",
      summary: "Created the requested pull request",
      branch: "mystra/task-12",
      reviewResult: {
        status: "review_created",
        branch: {
          status: "pushed",
          branchName: "mystra/task-12",
          branchUrl: "https://github.com/acme/project/tree/mystra%2Ftask-12",
        },
        review: {
          provider: "github",
          url: "https://github.com/acme/project/pull/12",
          number: 12,
          displayId: "#12",
        },
        metadata: {
          repo: "acme/project",
          targetBranch: "main",
        },
      },
    });

    expect(parsed.reviewResult?.review).toEqual({
      provider: "github",
      url: "https://github.com/acme/project/pull/12",
      number: 12,
      displayId: "#12",
    });
  });
});
