import { describe, expect, it } from "vitest";

import {
  sandboxLaunchRequestSchema,
  sandboxObservationSchema,
  sandboxOutcomeSchema,
  sandboxPortBindingSchema,
} from "./sandbox.js";

describe("sandbox provider schemas", () => {
  it("accepts a launch request driven by the resolved runtime contract", () => {
    const parsed = sandboxLaunchRequestSchema.parse({
      runId: "00000000-0000-4000-8000-000000000201",
      runtime: {
        provider: "docker",
        environment: {
          image: "ghcr.io/acme/mystra-runtime:latest",
        },
        mounts: [{ kind: "workspace", target: "/mystra/workspace", readOnly: false }],
        exposedPorts: [{ containerPort: 3000, name: "frontend" }],
        cache: { coldStartAllowed: true, entries: [] },
        contextBundles: [],
        secrets: [{ name: "MYSTRA_GITLAB_TOKEN", mode: "env" }],
      },
      workspacePath: "/var/lib/mystra/workspaces/run-201",
      retentionPolicy: "retain_for_preview",
    });

    expect(parsed.runtime.environment.image).toBe("ghcr.io/acme/mystra-runtime:latest");
    expect(parsed.retentionPolicy).toBe("retain_for_preview");
  });

  it("accepts sandbox observations with explicit empty port exposure", () => {
    const parsed = sandboxObservationSchema.parse({
      session: {
        provider: "docker",
        sessionId: "container-123",
        status: "running",
        startedAt: "2026-05-14T00:00:00.000Z",
        retained: false,
      },
    });

    expect(parsed.ports).toEqual([]);
    expect(parsed.metadata).toEqual({});
  });

  it("accepts successful execution with failed cleanup as separate outcomes", () => {
    const parsed = sandboxOutcomeSchema.parse({
      status: "succeeded",
      session: {
        provider: "docker",
        sessionId: "container-456",
        status: "cleanup_failed",
        startedAt: "2026-05-14T00:00:00.000Z",
        finishedAt: "2026-05-14T00:05:00.000Z",
        retained: false,
      },
      ports: [
        {
          name: "frontend",
          containerPort: 3000,
          hostBinding: "0.0.0.0:41001",
          url: "http://127.0.0.1:41001",
          reachable: true,
        },
      ],
      cleanup: {
        status: "failed",
        attemptedAt: "2026-05-14T00:05:02.000Z",
        errorCode: "cleanup_failed",
        errorMessage: "docker stop timed out",
      },
    });

    expect(parsed.status).toBe("succeeded");
    expect(parsed.cleanup.status).toBe("failed");
    expect(parsed.ports[0]?.url).toBe("http://127.0.0.1:41001");
  });

  it("rejects non-positive container ports", () => {
    expect(() =>
      sandboxPortBindingSchema.parse({
        containerPort: 0,
        reachable: false,
      }),
    ).toThrow();
  });
});
