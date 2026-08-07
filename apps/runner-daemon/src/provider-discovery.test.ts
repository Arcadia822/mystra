import { describe, expect, it } from "vitest";

import {
  discoverProviderCapabilities,
  type ProviderDiscoveryDependencies,
} from "./provider-discovery.js";

function dependencies(
  overrides: Partial<ProviderDiscoveryDependencies> = {},
): ProviderDiscoveryDependencies {
  return {
    resolvePath: async () => null,
    resolveLoginShellPaths: async () => new Map(),
    isExecutable: async () => true,
    probe: async () => ({ available: true, version: "1.0.0" }),
    ...overrides,
  };
}

describe("discoverProviderCapabilities", () => {
  it("reports PATH discovery and separately confirms availability", async () => {
    const capabilities = await discoverProviderCapabilities({
      providerKeys: ["codex", "copilot"],
      environment: {},
      dependencies: dependencies({
        resolvePath: async (provider) => provider === "codex" ? "/usr/bin/codex" : null,
        probe: async (resolvedPath) => resolvedPath === "/usr/bin/codex"
          ? { available: true, version: "0.39.0" }
          : { available: false, unavailableReason: "exec-failed" },
      }),
    });

    expect(capabilities).toEqual([
      {
        provider: "codex",
        discovered: true,
        available: true,
        source: "path",
        resolvedPath: "/usr/bin/codex",
        version: "0.39.0",
        unavailableReason: null,
      },
      {
        provider: "copilot",
        discovered: false,
        available: false,
        source: "path",
        resolvedPath: null,
        version: null,
        unavailableReason: "not-found",
      },
    ]);
  });

  it("uses an explicit override and never falls back when it is missing", async () => {
    let resolvedPathCalled = false;
    const capabilities = await discoverProviderCapabilities({
      providerKeys: ["copilot"],
      environment: { MYSTRA_COPILOT_PATH: "/missing/copilot" },
      dependencies: dependencies({
        resolvePath: async () => {
          resolvedPathCalled = true;
          return "/usr/bin/copilot";
        },
        isExecutable: async () => false,
      }),
    });

    expect(resolvedPathCalled).toBe(false);
    expect(capabilities).toEqual([{
      provider: "copilot",
      discovered: false,
      available: false,
      source: "env-override",
      resolvedPath: null,
      version: null,
      unavailableReason: "override-path-missing",
    }]);
  });

  it("uses a validated login-shell result only after PATH misses", async () => {
    const capabilities = await discoverProviderCapabilities({
      providerKeys: ["codex"],
      environment: {},
      dependencies: dependencies({
        resolveLoginShellPaths: async () => new Map([["codex", "/shell/bin/codex"]]),
      }),
    });

    expect(capabilities[0]).toMatchObject({
      provider: "codex",
      discovered: true,
      available: true,
      source: "login-shell",
      resolvedPath: "/shell/bin/codex",
    });
  });
});
