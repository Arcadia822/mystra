import { describe, expect, it, vi } from "vitest";

import { EXIT_CODES, parseArgs, run } from "../../../../scripts/operator-cli.mjs";

type ResponseLike = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function projectDetailPayload() {
  return {
    project: {
      id: "00000000-0000-4000-8000-000000000001",
      name: "Mystra",
      slug: "mystra",
      repo: "git@example.com:arcadia/mystra.git",
      baseBranch: "main",
      defaultAgent: "codex",
      runtime: {
        provider: "docker",
        image: "ghcr.io/arcadia/mystra-runner:latest",
        contextBundleRefs: [{ slug: "agent-skills", required: true, accessMode: "read-only" }],
        mounts: [],
        exposedPorts: [],
        cache: { coldStartAllowed: true, entries: [] },
        secretRefs: [],
        overridePolicy: {
          allowImageOverride: false,
          allowContextBundleAdditions: false,
          allowedContextBundleSlugs: [],
        },
        metadata: {},
      },
      prewarmConfig: { manager: "pnpm" },
      metadata: {},
      lane: {
        repo: "git@example.com:arcadia/mystra.git",
        baseBranch: "main",
        defaultAgent: "codex",
        runtime: {
          provider: "docker",
          image: "ghcr.io/arcadia/mystra-runner:latest",
          contextBundleRefs: [{ slug: "agent-skills", required: true, accessMode: "read-only" }],
          mounts: [],
          exposedPorts: [],
          cache: { coldStartAllowed: true, entries: [] },
          secretRefs: [],
          overridePolicy: {
            allowImageOverride: false,
            allowContextBundleAdditions: false,
            allowedContextBundleSlugs: [],
          },
          metadata: {},
        },
        contextBundleRefs: [{ slug: "agent-skills", required: true, accessMode: "read-only" }],
        prewarmConfig: { manager: "pnpm" },
        workflow: { provider: "local", blueprintName: "mvp.coding", blueprintVersion: "1.0.0" },
        metadata: {},
      },
      archivedAt: null,
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T00:00:00.000Z",
    },
  };
}

function jobSnapshot(overrides: Record<string, unknown> = {}) {
  const base = {
    job: {
      id: "00000000-0000-4000-8000-000000000010",
      spec: {
        taskId: "TASK-1",
        source: "api",
        projectId: "00000000-0000-4000-8000-000000000001",
        branchName: "mystra/task-1",
        prompt: "Do the thing",
        metadata: {},
      },
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T00:01:00.000Z",
    },
    run: {
      id: "00000000-0000-4000-8000-000000000011",
      jobId: "00000000-0000-4000-8000-000000000010",
      state: "succeeded",
      attempt: 1,
      result: {
        status: "succeeded",
        summary: "Created the requested review",
        branch: "mystra/task-1",
        mrUrl: "https://example.com/mr/1",
        errorCode: undefined,
        errorMessage: undefined,
        metadata: {
          frontendPreviewUrl: "https://preview.example.com",
        },
      },
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T00:02:00.000Z",
      startedAt: "2026-05-17T00:00:10.000Z",
      finishedAt: "2026-05-17T00:02:00.000Z",
    },
    events: [],
    workflow: {
      provider: "local",
      blueprintName: "mvp.coding",
      status: "started",
      startedAt: "2026-05-17T00:00:10.000Z",
      nodes: [],
    },
    project: projectDetailPayload().project,
    lane: {
      projectId: "00000000-0000-4000-8000-000000000001",
      projectSlug: "mystra",
      repo: "git@example.com:arcadia/mystra.git",
      baseBranch: "main",
      defaultAgent: "codex",
      runtime: {
        environment: {
          provider: "docker",
          image: "ghcr.io/arcadia/mystra-runner:latest",
        },
        contextBundles: [],
        mounts: [],
        exposedPorts: [],
        cache: { entries: [] },
        secrets: [],
        metadata: {},
      },
      contextBundleRefs: [{ slug: "agent-skills", required: true, accessMode: "read-only" }],
      prewarmConfig: { manager: "pnpm" },
      workflow: { provider: "local", blueprintName: "mvp.coding", blueprintVersion: "1.0.0" },
      metadata: {},
      submittedAt: "2026-05-17T00:00:00.000Z",
    },
    runtime: {
      environment: {
        provider: "docker",
        image: "ghcr.io/arcadia/mystra-runner:latest",
      },
      contextBundles: [],
      mounts: [],
      exposedPorts: [],
      cache: { entries: [] },
      secrets: [],
      metadata: {},
    },
  };

  return structuredClone({ ...base, ...overrides });
}

async function execute(argv: string[], responder: (url: string) => ResponseLike | Promise<ResponseLike>) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const fetchImpl = vi.fn(async (url: URL | string) => await responder(String(url)));
  const exitCode = await run(argv, {
    fetchImpl,
    stdout: (text: string) => void stdout.push(text),
    stderr: (text: string) => void stderr.push(text),
  });

  return {
    exitCode,
    stdout: stdout.join(""),
    stderr: stderr.join(""),
    fetchImpl,
  };
}

describe("operator CLI", () => {
  it("parses commands and shared flags", () => {
    expect(parseArgs(["--", "runs", "inspect", "job-123", "--json", "--control-plane-url", "http://localhost:4000"])).toEqual({
      ok: true,
      value: {
        group: "runs",
        command: "inspect",
        target: "job-123",
        json: true,
        controlPlaneUrl: "http://localhost:4000",
      },
    });
  });

  it("prints a human-readable project list", async () => {
    const result = await execute(["projects", "list"], async () => response({
      projects: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          name: "Mystra",
          slug: "mystra",
          repo: "git@example.com:arcadia/mystra.git",
          baseBranch: "main",
          defaultAgent: "codex",
          archivedAt: null,
          createdAt: "2026-05-17T00:00:00.000Z",
          updatedAt: "2026-05-17T00:00:00.000Z",
        },
      ],
    }));

    expect(result.exitCode).toBe(EXIT_CODES.OK);
    expect(result.stdout).toContain("Projects");
    expect(result.stdout).toContain("mystra");
    expect(result.stderr).toBe("");
  });

  it("prints project detail as JSON when requested", async () => {
    const result = await execute(["projects", "inspect", "mystra", "--json"], async () => response(projectDetailPayload()));

    expect(result.exitCode).toBe(EXIT_CODES.OK);
    expect(JSON.parse(result.stdout)).toEqual(projectDetailPayload());
  });

  it("prints a human-readable run list", async () => {
    const result = await execute(["runs", "list"], async () => response({
      jobs: [jobSnapshot()],
    }));

    expect(result.exitCode).toBe(EXIT_CODES.OK);
    expect(result.stdout).toContain("Runs");
    expect(result.stdout).toContain("state=succeeded");
    expect(result.stdout).toContain("project=mystra");
    expect(result.stdout).toContain("updated=2026-05-17T00:02:00.000Z");
  });

  it("prints workflow and lane facts for run inspection", async () => {
    const result = await execute(["runs", "inspect", "job-1"], async () => response(jobSnapshot()));

    expect(result.exitCode).toBe(EXIT_CODES.OK);
    expect(result.stdout).toContain("workflow: local | mvp.coding");
    expect(result.stdout).toContain("currentLaneContext: agent-skills");
    expect(result.stdout).toContain("submittedLaneContext: agent-skills");
  });

  it("prints a terminal result summary", async () => {
    const result = await execute(["runs", "result", "job-1"], async () => response(jobSnapshot()));

    expect(result.exitCode).toBe(EXIT_CODES.OK);
    expect(result.stdout).toContain("Result 00000000-0000-4000-8000-000000000010");
    expect(result.stdout).toContain("Created the requested review");
    expect(result.stdout).toContain("https://example.com/mr/1");
  });

  it("returns RESULT_NOT_READY when the run is still active", async () => {
    const active = jobSnapshot({
      run: {
        ...jobSnapshot().run,
        state: "running",
        result: undefined,
        finishedAt: undefined,
      },
    });
    const result = await execute(["runs", "result", "job-1", "--json"], async () => response(active));

    expect(result.exitCode).toBe(EXIT_CODES.NOT_READY);
    expect(JSON.parse(result.stderr)).toEqual({
      ok: false,
      code: "RESULT_NOT_READY",
      message: "Run result is not ready yet.",
      payload: {
        jobId: "00000000-0000-4000-8000-000000000010",
        runState: "running",
      },
    });
  });

  it("prints failure context for failed runs", async () => {
    const failed = jobSnapshot({
      run: {
        ...jobSnapshot().run,
        state: "failed",
        result: {
          status: "failed",
          summary: "Tests failed",
          branch: "mystra/task-1",
          errorCode: "QUALITY_GATE_FAILED",
          errorMessage: "Vitest failed",
          metadata: {},
        },
      },
    });
    const result = await execute(["runs", "failure", "job-1"], async () => response(failed));

    expect(result.exitCode).toBe(EXIT_CODES.OK);
    expect(result.stdout).toContain("Failure 00000000-0000-4000-8000-000000000010");
    expect(result.stdout).toContain("QUALITY_GATE_FAILED");
    expect(result.stdout).toContain("Vitest failed");
  });

  it("returns RESULT_NOT_READY when failure context is requested for an active run", async () => {
    const active = jobSnapshot({
      run: {
        ...jobSnapshot().run,
        state: "running",
        result: undefined,
        finishedAt: undefined,
      },
    });
    const result = await execute(["runs", "failure", "job-1", "--json"], async () => response(active));

    expect(result.exitCode).toBe(EXIT_CODES.NOT_READY);
    expect(JSON.parse(result.stderr)).toEqual({
      ok: false,
      code: "RESULT_NOT_READY",
      message: "Failure context is not ready yet.",
      payload: {
        jobId: "00000000-0000-4000-8000-000000000010",
        runState: "running",
      },
    });
  });

  it("returns RESULT_UNAVAILABLE when failure context is requested for a successful run", async () => {
    const result = await execute(["runs", "failure", "job-1", "--json"], async () => response(jobSnapshot()));

    expect(result.exitCode).toBe(EXIT_CODES.UNAVAILABLE);
    expect(JSON.parse(result.stderr)).toEqual({
      ok: false,
      code: "RESULT_UNAVAILABLE",
      message: "Failure context is unavailable for this run.",
      payload: {
        jobId: "00000000-0000-4000-8000-000000000010",
        runState: "succeeded",
      },
    });
  });

  it("maps management API errors to operator outcomes", async () => {
    const result = await execute(["runs", "inspect", "missing"], async () => response({
      error: {
        code: "JOB_NOT_FOUND",
        message: "Job not found: missing",
      },
    }, 404));

    expect(result.exitCode).toBe(EXIT_CODES.MISSING);
    expect(result.stderr).toContain("ERROR JOB_NOT_FOUND: Job not found: missing");
  });

  it("maps body-stream failures to a transport outcome instead of crashing", async () => {
    const result = await execute(["projects", "list", "--json"], async () => ({
      ok: true,
      status: 200,
      text: async () => {
        throw new Error("stream lost");
      },
    }));

    expect(result.exitCode).toBe(EXIT_CODES.TRANSPORT_ERROR);
    expect(JSON.parse(result.stderr)).toEqual({
      ok: false,
      code: "TRANSPORT_ERROR",
      message: "stream lost",
      payload: {
        url: "http://localhost:3000/api/projects",
      },
    });
  });
});
