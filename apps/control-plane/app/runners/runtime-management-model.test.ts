import { describe, expect, it } from "vitest";

import { availableProviders, type RuntimesResponse } from "./runtime-management-model";

const runtime = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Build host",
  type: "host" as const,
  metadata: {
    runnerId: "runner-1",
    platform: "darwin/arm64",
    workspaceMaterialization: {
      version: 1 as const,
      kinds: ["task-repository"] as ["task-repository"],
      sharingModes: ["shared-mutable"] as ["shared-mutable"],
    },
  },
  status: "online" as const,
  lastSeenAt: "2026-08-07T10:00:00.000Z",
  providers: [
    {
      provider: "copilot" as const,
      discovered: true,
      available: true,
      source: "path" as const,
      resolvedPath: "/usr/local/bin/copilot",
      version: "1.0.0",
      unavailableReason: null,
    },
    {
      provider: "codex" as const,
      discovered: false,
      available: false,
      source: "path" as const,
      resolvedPath: null,
      version: null,
      unavailableReason: "not-found" as const,
    },
  ],
  createdAt: "2026-08-07T10:00:00.000Z",
  updatedAt: "2026-08-07T10:00:00.000Z",
};

describe("Runtime management model", () => {
  it("accepts the runtime list API contract and exposes only available Providers", () => {
    const response = { runtimes: [runtime] } satisfies RuntimesResponse;

    expect(availableProviders(response.runtimes[0]!)).toEqual([runtime.providers[0]]);
  });
});
