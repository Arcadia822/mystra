import { describe, expect, it } from "vitest";

import {
  HostLivenessRegistry,
  resolveRuntimeStatus,
} from "./host-liveness";

describe("HostLivenessRegistry", () => {
  it("stores the most recent server-side liveness signal in memory", () => {
    const registry = new HostLivenessRegistry();
    const seenAt = new Date("2026-08-07T10:00:00.000Z");

    registry.markSeen("runner-1", seenAt);

    expect(registry.getLastSeen("runner-1")).toBe("2026-08-07T10:00:00.000Z");
  });
});

describe("resolveRuntimeStatus", () => {
  it("treats missing liveness as offline", () => {
    expect(resolveRuntimeStatus(null, new Date("2026-08-07T10:00:00.000Z"), 180)).toBe("offline");
  });

  it("keeps a Runtime online at the staleness boundary", () => {
    expect(resolveRuntimeStatus(
      "2026-08-07T09:57:00.000Z",
      new Date("2026-08-07T10:00:00.000Z"),
      180,
    )).toBe("online");
  });

  it("marks a Runtime offline after the staleness boundary", () => {
    expect(resolveRuntimeStatus(
      "2026-08-07T09:56:59.999Z",
      new Date("2026-08-07T10:00:00.000Z"),
      180,
    )).toBe("offline");
  });
});
