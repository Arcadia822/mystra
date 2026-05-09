import { describe, expect, it } from "vitest";

import {
  agentNameSchema,
  jobSpecSchema,
  platformCapabilitiesSchema,
  platformDefaultsSchema,
  projectConfigSchema,
  runnerRegistrationSchema,
} from "./schemas.js";

describe("jobSpecSchema", () => {
  it("accepts a minimal API job with a task-provided branch name", () => {
    const parsed = jobSpecSchema.parse({
      taskId: "task-1",
      source: "api",
      repo: "gitlab.example.com/group/project",
      branchName: "feature/mystra-task-1",
      agent: "codex",
      prompt: "Update the README",
    });

    expect(parsed.baseBranch).toBe("main");
    expect(parsed.metadata).toEqual({});
    expect(parsed.branchName).toBe("feature/mystra-task-1");
  });

  it("does not sanitize task-provided branch names", () => {
    const parsed = jobSpecSchema.parse({
      taskId: "task-2",
      source: "mcp",
      repo: "gitlab.example.com/group/project",
      branchName: "UPPER/space allowed by task",
      agent: "copilot",
      prompt: "Make the requested change",
    });

    expect(parsed.branchName).toBe("UPPER/space allowed by task");
  });

  it("rejects jobs without a branch name", () => {
    expect(() =>
      jobSpecSchema.parse({
        taskId: "task-3",
        source: "api",
        repo: "gitlab.example.com/group/project",
        agent: "codex",
        prompt: "Update the README",
      }),
    ).toThrow();
  });

  it("rejects agents outside the MVP adapter set", () => {
    expect(() => agentNameSchema.parse("claude")).toThrow();
    expect(() => agentNameSchema.parse("opencode")).toThrow();
  });

  it("rejects callback URLs because callbacks are not in the MVP contract", () => {
    expect(() =>
      jobSpecSchema.parse({
        taskId: "task-4",
        source: "api",
        repo: "gitlab.example.com/group/project",
        branchName: "feature/task-4",
        agent: "codex",
        prompt: "Update the README",
        callbackUrl: "https://example.com/callback",
      }),
    ).toThrow();
  });
});

describe("platformCapabilitiesSchema", () => {
  it("accepts typed runner capabilities", () => {
    const parsed = platformCapabilitiesSchema.parse({
      agents: ["codex", "copilot"],
      executor: "docker",
      image: "ghcr.io/acme/mystra-runner:latest",
    });

    expect(parsed.agents).toEqual(["codex", "copilot"]);
    expect(parsed.executor).toBe("docker");
    expect(parsed.image).toBe("ghcr.io/acme/mystra-runner:latest");
  });

  it("accepts capabilities without an image override", () => {
    const parsed = platformCapabilitiesSchema.parse({
      agents: ["codex"],
      executor: "fake",
    });

    expect(parsed.image).toBeUndefined();
  });

  it("rejects unknown capability keys", () => {
    expect(() =>
      platformCapabilitiesSchema.parse({
        agents: ["codex"],
        executor: "docker",
        skills: ["gnhf"],
      }),
    ).toThrow();
  });

  it("rejects empty agent lists", () => {
    expect(() =>
      platformCapabilitiesSchema.parse({
        agents: [],
        executor: "docker",
      }),
    ).toThrow();
  });

  it("rejects unsupported executors", () => {
    expect(() =>
      platformCapabilitiesSchema.parse({
        agents: ["codex"],
        executor: "kubernetes",
      }),
    ).toThrow();
  });
});

describe("platformDefaultsSchema", () => {
  it("applies MVP defaults", () => {
    const parsed = platformDefaultsSchema.parse({});

    expect(parsed).toEqual({
      maxConcurrency: 1,
      runTimeoutSeconds: 3600,
      heartbeatExpirySeconds: 90,
      longPollTimeoutSeconds: 25,
      containerCpuQuota: 4,
      containerMemoryGb: 8,
    });
  });

  it("rejects unknown default fields", () => {
    expect(() =>
      platformDefaultsSchema.parse({
        maxConcurrency: 2,
        retryCount: 3,
      }),
    ).toThrow();
  });

  it("rejects non-positive limits", () => {
    expect(() =>
      platformDefaultsSchema.parse({
        maxConcurrency: 0,
      }),
    ).toThrow();
  });
});

describe("projectConfigSchema", () => {
  it("accepts project-scoped config and applies metadata/baseBranch defaults", () => {
    const parsed = projectConfigSchema.parse({
      repo: "gitlab.example.com/group/project",
      branchName: "feature/project-config",
      agent: "copilot",
      prompt: "Implement the requested change",
    });

    expect(parsed.baseBranch).toBe("main");
    expect(parsed.metadata).toEqual({});
  });

  it("accepts merge request metadata", () => {
    const parsed = projectConfigSchema.parse({
      repo: "gitlab.example.com/group/project",
      branchName: "feature/mr-spec",
      agent: "codex",
      prompt: "Prepare a merge request",
      mergeRequest: {
        title: "Add typed project config",
        body: "Document the new separation.",
      },
    });

    expect(parsed.mergeRequest?.title).toBe("Add typed project config");
  });

  it("rejects platform capability fields", () => {
    expect(() =>
      projectConfigSchema.parse({
        repo: "gitlab.example.com/group/project",
        branchName: "feature/invalid-project-config",
        agent: "codex",
        prompt: "Keep concerns separate",
        executor: "docker",
      }),
    ).toThrow();
  });

  it("rejects unknown project fields", () => {
    expect(() =>
      projectConfigSchema.parse({
        repo: "gitlab.example.com/group/project",
        branchName: "feature/invalid-project-config",
        agent: "codex",
        prompt: "Keep concerns separate",
        image: "ghcr.io/acme/mystra-runner:latest",
      }),
    ).toThrow();
  });
});

describe("runnerRegistrationSchema", () => {
  it("requires typed platform capabilities", () => {
    const parsed = runnerRegistrationSchema.parse({
      runnerName: "runner-1",
      capabilities: {
        agents: ["codex", "copilot"],
        executor: "fake",
      },
    });

    expect(parsed.capabilities.executor).toBe("fake");
    expect(parsed.maxConcurrency).toBe(1);
  });

  it("rejects untyped capability bags", () => {
    expect(() =>
      runnerRegistrationSchema.parse({
        runnerName: "runner-2",
        capabilities: {
          supportsDocker: true,
        },
      }),
    ).toThrow();
  });
});
