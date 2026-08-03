import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  attachDockerSandboxOutcome,
  buildDockerSandboxPorts,
  dockerSandboxProvider,
} from "./docker.js";

const spawnMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

describe("docker sandbox projections", () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockSpawnExit(code: number, stdout = "", stderr = ""): void {
    spawnMock.mockImplementation(() => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
      };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      queueMicrotask(() => {
        if (stdout) {
          child.stdout.emit("data", Buffer.from(stdout));
        }
        if (stderr) {
          child.stderr.emit("data", Buffer.from(stderr));
        }
        child.emit("exit", code);
      });
      return child;
    });
  }

  it("maps preview host bindings and URLs into provider-neutral sandbox ports", () => {
    const ports = buildDockerSandboxPorts(
      [
        { name: "frontend", containerPort: 3000, hostBinding: "0.0.0.0::3000" },
        { name: "backend", containerPort: 8000, hostBinding: "0.0.0.0::8000" },
      ],
      "0.0.0.0:41000\n",
      "",
      "http://127.0.0.1:41000",
      null,
    );

    expect(ports).toEqual([
      {
        name: "frontend",
        containerPort: 3000,
        hostBinding: "0.0.0.0:41000",
        url: "http://127.0.0.1:41000",
        reachable: true,
      },
      {
        name: "backend",
        containerPort: 8000,
        hostBinding: "0.0.0.0::8000",
        reachable: false,
      },
    ]);
  });

  it("attaches sandbox outcome using current Docker retention and cleanup facts", () => {
    const result = attachDockerSandboxOutcome(
      {
        status: "succeeded" as const,
        summary: "Created review and retained preview container",
      },
      {
        sessionId: "container-123",
        startedAt: "2026-05-14T00:00:00.000Z",
        finishedAt: "2026-05-14T00:05:00.000Z",
        retained: true,
        cleanupStatus: "skipped",
        cleanupAttemptedAt: "2026-05-14T00:05:00.000Z",
        runtimePorts: [{ name: "frontend", containerPort: 3000 }],
        frontendPortOutput: "0.0.0.0:41000",
        backendPortOutput: "",
        frontendUrl: "http://127.0.0.1:41000",
        backendUrl: null,
      },
    );

    expect(result.sandboxOutcome).toEqual({
      status: "succeeded",
      session: {
        provider: "docker",
        sessionId: "container-123",
        status: "retained",
        startedAt: "2026-05-14T00:00:00.000Z",
        finishedAt: "2026-05-14T00:05:00.000Z",
        retained: true,
      },
      ports: [
        {
          name: "frontend",
          containerPort: 3000,
          hostBinding: "0.0.0.0:41000",
          url: "http://127.0.0.1:41000",
          reachable: true,
        },
      ],
      cleanup: {
        status: "skipped",
        attemptedAt: "2026-05-14T00:05:00.000Z",
      },
      metadata: {},
    });
  });

  it("launches a Docker sandbox through the provider", async () => {
    mockSpawnExit(0, "container-123\n");

    const session = await dockerSandboxProvider.launch({
      sessionId: "00000000-0000-4000-8000-000000000501",
      runtime: {
        provider: "docker",
        environment: {
          image: "ghcr.io/acme/image:latest",
          metadata: {},
        },
        contextBundles: [],
        mounts: [],
        exposedPorts: [],
        cache: { coldStartAllowed: true, entries: [] },
        secrets: [],
      },
      workspacePath: "/tmp/workspace",
      gitMirrorPath: "/tmp/git/repo.git",
      retentionPolicy: "retain_for_preview",
    }, {
      dockerArgs: ["run", "-d", "--name", "mystra-run", "ghcr.io/acme/image:latest", "sleep", "infinity"],
      containerName: "mystra-run",
      env: process.env,
    });

    expect(session.provider).toBe("docker");
    expect(session.sessionId).toBe("mystra-run");
    expect(session.status).toBe("running");
    expect(session.retained).toBe(true);
  });

  it("stops a Docker sandbox through the provider", async () => {
    mockSpawnExit(0);

    const cleanup = await dockerSandboxProvider.stop({
      provider: "docker",
      sessionId: "mystra-run",
      status: "running",
      startedAt: "2026-05-14T00:00:00.000Z",
      retained: true,
    }, "cancel", {
      cleanupTimeoutSeconds: 45,
    });

    expect(cleanup).toEqual({
      status: "succeeded",
      attemptedAt: expect.any(String),
    });
    expect(spawnMock).toHaveBeenCalledWith("docker", ["stop", "--time", "45", "mystra-run"], expect.any(Object));
  });

  it("inspects Docker port bindings through the provider", async () => {
    spawnMock
      .mockImplementationOnce(() => {
        const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        queueMicrotask(() => {
          child.stdout.emit("data", Buffer.from("0.0.0.0:41000\n"));
          child.emit("exit", 0);
        });
        return child;
      })
      .mockImplementationOnce(() => {
        const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        queueMicrotask(() => {
          child.emit("exit", 1);
        });
        return child;
      });

    const observation = await dockerSandboxProvider.inspect({
      provider: "docker",
      sessionId: "mystra-run",
      status: "running",
      startedAt: "2026-05-14T00:00:00.000Z",
      retained: true,
    }, {
      runtimePorts: [
        { name: "frontend", containerPort: 3000, hostBinding: "0.0.0.0::3000" },
        { name: "backend", containerPort: 8000, hostBinding: "0.0.0.0::8000" },
      ],
      previewHost: "127.0.0.1",
    });

    expect(observation.ports).toEqual([
      {
        name: "frontend",
        containerPort: 3000,
        hostBinding: "0.0.0.0:41000",
        url: "http://127.0.0.1:41000",
        reachable: true,
      },
      {
        name: "backend",
        containerPort: 8000,
        hostBinding: "0.0.0.0::8000",
        reachable: false,
      },
    ]);
  });

  it("collects Docker sandbox outcomes through the provider", async () => {
    const outcome = await dockerSandboxProvider.collectOutcome({
      provider: "docker",
      sessionId: "mystra-run",
      status: "running",
      startedAt: "2026-05-14T00:00:00.000Z",
      retained: true,
    }, {
      status: "succeeded",
      observation: {
        session: {
          provider: "docker",
          sessionId: "mystra-run",
          status: "running",
          startedAt: "2026-05-14T00:00:00.000Z",
          retained: true,
        },
        ports: [
          {
            name: "frontend",
            containerPort: 3000,
            hostBinding: "0.0.0.0:41000",
            url: "http://127.0.0.1:41000",
            reachable: true,
          },
        ],
        metadata: {},
      },
      cleanup: {
        status: "skipped",
        attemptedAt: "2026-05-14T00:05:00.000Z",
      },
      finishedAt: "2026-05-14T00:05:00.000Z",
      retained: true,
    });

    expect(outcome).toEqual({
      status: "succeeded",
      session: {
        provider: "docker",
        sessionId: "mystra-run",
        status: "retained",
        startedAt: "2026-05-14T00:00:00.000Z",
        finishedAt: "2026-05-14T00:05:00.000Z",
        retained: true,
      },
      ports: [
        {
          name: "frontend",
          containerPort: 3000,
          hostBinding: "0.0.0.0:41000",
          url: "http://127.0.0.1:41000",
          reachable: true,
        },
      ],
      cleanup: {
        status: "skipped",
        attemptedAt: "2026-05-14T00:05:00.000Z",
      },
      metadata: {},
    });
  });
});
