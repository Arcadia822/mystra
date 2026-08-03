import { describe, expect, it } from "vitest";

import { resolveRuntimeContract } from "./resolve-runtime";

const timestamp = "2026-05-09T00:00:00.000Z";

const issueContextBundle = {
  id: "00000000-0000-4000-8000-000000000030",
  slug: "issue-context",
  displayName: "Issue Context",
  source: {
    kind: "session-inline" as const,
    metadata: {
      prompt: "Use the supplied issue context.",
    },
  },
  accessMode: "session-scoped" as const,
  mountPath: "/mystra/context/issue",
  freshness: {},
  failureMode: "fail-session" as const,
  metadata: {},
  archivedAt: null,
  createdAt: timestamp,
  updatedAt: timestamp,
};

const project = {
  runtime: {
    provider: "docker" as const,
    image: "project-runner:latest",
    contextBundleRefs: [],
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
};

describe("resolveRuntimeContract", () => {
  it("resolves Project runtime into a runner contract", () => {
    const runtime = resolveRuntimeContract({ project });

    expect(runtime.provider).toBe("docker");
    expect(runtime.environment.image).toBe("project-runner:latest");
    expect(runtime.contextBundles).toEqual([]);
  });

  it("rejects image overrides unless allowed by Project policy", () => {
    expect(() =>
      resolveRuntimeContract({
        project,
        override: { image: "override-runner:latest" },
      }),
    ).toThrow(/RUNTIME_IMAGE_OVERRIDE_NOT_ALLOWED/);

    const runtime = resolveRuntimeContract({
      project: {
        ...project,
        runtime: {
          ...project.runtime,
          overridePolicy: {
            ...project.runtime.overridePolicy,
            allowImageOverride: true,
          },
        },
      },
      override: { image: "override-runner:latest" },
    });

    expect(runtime.environment.image).toBe("override-runner:latest");
  });

  it("rejects future runtime profile selection until Project profile management exists", () => {
    expect(() =>
      resolveRuntimeContract({
        project,
        override: { runtimeProfile: "frontend-dev" },
      }),
    ).toThrow(/RUNTIME_PROFILE_NOT_SUPPORTED/);
  });

  it("rejects override attempts for mounts, secrets, cache, and ports", () => {
    expect(() =>
      resolveRuntimeContract({
        project,
        override: { mounts: [{ kind: "cache", target: "/mystra/cache/custom" }] },
      }),
    ).toThrow();
    expect(() =>
      resolveRuntimeContract({
        project,
        override: { secretRefs: [{ name: "MYSTRA_GITLAB_TOKEN", mode: "env" }] },
      }),
    ).toThrow();
    expect(() =>
      resolveRuntimeContract({
        project,
        override: { cache: { coldStartAllowed: true, entries: [] } },
      }),
    ).toThrow();
    expect(() =>
      resolveRuntimeContract({
        project,
        override: { exposedPorts: [{ containerPort: 3000 }] },
      }),
    ).toThrow();
  });

  it("rejects context bundle overrides unless allowed by Project policy", () => {
    expect(() =>
      resolveRuntimeContract({
        project,
        override: {
          contextBundleRefs: [{ slug: "issue-context", required: true, accessMode: "session-scoped" }],
        },
      }),
    ).toThrow(/RUNTIME_CONTEXT_BUNDLE_OVERRIDE_NOT_ALLOWED/);

    const runtime = resolveRuntimeContract({
      project: {
        ...project,
        runtime: {
          ...project.runtime,
          overridePolicy: {
            ...project.runtime.overridePolicy,
            allowContextBundleAdditions: true,
            allowedContextBundleSlugs: ["issue-context"],
          },
        },
      },
      override: {
        contextBundleRefs: [{ slug: "issue-context", required: true, accessMode: "session-scoped" }],
      },
      contextBundles: [issueContextBundle],
    });

    expect(runtime.contextBundles.map((bundle) => bundle.slug)).toEqual(["issue-context"]);
    expect(runtime.contextBundles[0]?.source.kind).toBe("session-inline");
    expect(runtime.mounts).toContainEqual({
      kind: "contextBundle",
      owner: "project",
      target: "/mystra/context/issue",
      sourceRef: "issue-context",
      readOnly: true,
    });
  });

  it("fails required missing context bundles before runner execution", () => {
    expect(() =>
      resolveRuntimeContract({
        project: {
          ...project,
          runtime: {
            ...project.runtime,
            contextBundleRefs: [{ slug: "agent-skills", required: true, accessMode: "read-only" as const }],
          },
        },
      }),
    ).toThrow(/RUNTIME_CONTEXT_BUNDLE_NOT_FOUND/);
  });

  it("skips optional missing context bundles", () => {
    const runtime = resolveRuntimeContract({
      project: {
        ...project,
        runtime: {
          ...project.runtime,
          contextBundleRefs: [{ slug: "optional-context", required: false, accessMode: "read-only" as const }],
        },
      },
    });

    expect(runtime.contextBundles).toEqual([]);
  });
});
