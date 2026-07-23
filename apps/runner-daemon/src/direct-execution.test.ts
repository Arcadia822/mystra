import { describe, expect, it, vi } from "vitest";

import { executeDirectExecution } from "./direct-execution.js";

type Overrides = {
  agentExitCode?: number;
  changedFiles?: string[];
  testStatus?: "passed" | "failed";
  buildStatus?: "passed" | "failed";
};

function fixture(overrides: Overrides = {}) {
  const calls: string[] = [];
  const environments: NodeJS.ProcessEnv[] = [];
  const emit = vi.fn(async (type: string) => {
    calls.push(`event:${type}`);
  });
  const dependencies = {
    emit,
    async launchSandbox(input: { environment: NodeJS.ProcessEnv }) {
      calls.push("launch");
      environments.push({ phase: "launch", ...input.environment });
    },
    async clone(input: { environment: NodeJS.ProcessEnv }) {
      calls.push("clone");
      environments.push({ phase: "clone", ...input.environment });
      return { baseCommit: "base-commit" };
    },
    async runAgent(input: { environment: NodeJS.ProcessEnv }) {
      calls.push("agent");
      environments.push({ phase: "agent", ...input.environment });
      return {
        exitCode: overrides.agentExitCode ?? 0,
        cliVersion: "1.0.69-0",
        changedFiles: overrides.changedFiles ?? ["src/demo.ts"],
      };
    },
    async runTest(input: { environment: NodeJS.ProcessEnv }) {
      calls.push("test");
      environments.push({ phase: "test", ...input.environment });
      return {
        status: overrides.testStatus ?? "passed" as const,
        command: "pnpm test",
        durationMs: 100,
      };
    },
    async runBuild(input: { environment: NodeJS.ProcessEnv }) {
      calls.push("build");
      environments.push({ phase: "build", ...input.environment });
      return {
        status: overrides.buildStatus ?? "passed" as const,
        command: "pnpm build",
        durationMs: 200,
      };
    },
  };

  return { calls, environments, dependencies };
}

describe("executeDirectExecution", () => {
  it("runs the explicit launch → clone → Agent → test → build phases and events", async () => {
    const { calls, dependencies } = fixture();

    const result = await executeDirectExecution({
      repositorySecret: { name: "MYSTRA_GITHUB_TOKEN", value: "github-secret" },
      agentSecret: { name: "COPILOT_GITHUB_TOKEN", value: "copilot-secret" },
      dependencies,
    });

    expect(result).toEqual({
      status: "succeeded",
      baseCommit: "base-commit",
      agentExecution: {
        agent: "copilot",
        cliVersion: "1.0.69-0",
        mode: "autopilot",
        maxAutopilotContinues: 10,
        exitCode: 0,
        changedFiles: ["src/demo.ts"],
      },
      quality: {
        test: { status: "passed", command: "pnpm test", durationMs: 100 },
        build: { status: "passed", command: "pnpm build", durationMs: 200 },
      },
    });
    expect(calls).toEqual([
      "event:execution.started",
      "launch",
      "event:repository.clone.started",
      "clone",
      "event:repository.clone.succeeded",
      "event:agent.started",
      "agent",
      "event:agent.succeeded",
      "event:quality.test.started",
      "test",
      "event:quality.test.passed",
      "event:quality.build.started",
      "build",
      "event:quality.build.passed",
    ]);
  });

  it("fails closed when the Agent exits nonzero", async () => {
    const { calls, dependencies } = fixture({ agentExitCode: 9 });

    const result = await executeDirectExecution({ dependencies });

    expect(result).toEqual(expect.objectContaining({
      status: "failed",
      errorCode: "agent_failed",
      agentExecution: expect.objectContaining({ exitCode: 9 }),
    }));
    expect(calls).toContain("event:agent.failed");
    expect(calls).not.toContain("test");
  });

  it("fails closed when the Agent produces no repository changes", async () => {
    const { calls, dependencies } = fixture({ changedFiles: [] });

    const result = await executeDirectExecution({ dependencies });

    expect(result).toEqual(expect.objectContaining({
      status: "failed",
      errorCode: "no_changes",
    }));
    expect(calls).toContain("event:agent.failed");
    expect(calls).not.toContain("test");
  });

  it("stops before build when tests fail", async () => {
    const { calls, dependencies } = fixture({ testStatus: "failed" });

    const result = await executeDirectExecution({ dependencies });

    expect(result).toEqual(expect.objectContaining({
      status: "failed",
      errorCode: "test_failed",
      quality: {
        test: { status: "failed", command: "pnpm test", durationMs: 100 },
      },
    }));
    expect(calls).toContain("event:quality.test.failed");
    expect(calls).not.toContain("build");
  });

  it("reports a build failure after passed tests", async () => {
    const { calls, dependencies } = fixture({ buildStatus: "failed" });

    const result = await executeDirectExecution({ dependencies });

    expect(result).toEqual(expect.objectContaining({
      status: "failed",
      errorCode: "build_failed",
      quality: {
        test: { status: "passed", command: "pnpm test", durationMs: 100 },
        build: { status: "failed", command: "pnpm build", durationMs: 200 },
      },
    }));
    expect(calls).toContain("event:quality.build.failed");
  });

  it("keeps repository and Copilot secrets phase-scoped", async () => {
    const { environments, dependencies } = fixture();

    await executeDirectExecution({
      repositorySecret: { name: "MYSTRA_GITHUB_TOKEN", value: "github-secret" },
      agentSecret: { name: "COPILOT_GITHUB_TOKEN", value: "copilot-secret" },
      dependencies,
    });

    expect(environments).toEqual([
      { phase: "launch" },
      { phase: "clone", MYSTRA_GITHUB_TOKEN: "github-secret" },
      { phase: "agent", COPILOT_GITHUB_TOKEN: "copilot-secret" },
      { phase: "test" },
      { phase: "build" },
    ]);
  });
});
