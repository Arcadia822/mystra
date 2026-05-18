import { describe, expect, it } from "vitest";

import { contextBundlePath, contextBundleSourcePath } from "./runtime-paths.js";

describe("contextBundlePath", () => {
  it("resolves materialized bundles beneath the runner cache root", () => {
    expect(contextBundlePath("/tmp/mystra-cache", "execution-spec-123")).toBe(
      "/tmp/mystra-cache/context-bundles/execution-spec-123",
    );
  });

  it("rejects refs that are not single safe path segments", () => {
    expect(() => contextBundlePath("/tmp/mystra-cache", "../escape")).toThrow(/single safe path segment/);
    expect(() => contextBundlePath("/tmp/mystra-cache", ".")).toThrow(/single safe path segment/);
    expect(() => contextBundlePath("/tmp/mystra-cache", "/tmp/escape")).toThrow(/single safe path segment/);
    expect(() => contextBundlePath("/tmp/mystra-cache", "foo/bar")).toThrow(/single safe path segment/);
  });
});

describe("contextBundleSourcePath", () => {
  it("resolves safe relative source refs beneath the configured source root", () => {
    expect(contextBundleSourcePath("/tmp/mystra-sources", "templates/agent-skills")).toBe(
      "/tmp/mystra-sources/templates/agent-skills",
    );
  });

  it("keeps absolute source refs for backward-compatible persisted bundles", () => {
    expect(contextBundleSourcePath("/tmp/mystra-sources", "/tmp/mystra-castrel-runner-image/skills")).toBe(
      "/tmp/mystra-castrel-runner-image/skills",
    );
  });

  it("rejects source refs that are traversal-based or protocol-based", () => {
    expect(() => contextBundleSourcePath("/tmp/mystra-sources", "../escape")).toThrow(/safe relative path segments/);
    expect(() => contextBundleSourcePath("/tmp/mystra-sources", "file:///tmp/escape")).toThrow(/Unsupported context bundle source ref/);
  });
});
