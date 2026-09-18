import { describe, expect, it } from "vitest";

import { EventDedupTable } from "./dedup.js";

describe("EventDedupTable", () => {
  const sample = {
    teamId: "team-1",
    integration: "linear",
    providerEventId: "delivery-1",
    eventType: "linear.issue.state_changed",
  };

  it("reserves new key and prevents duplicate reservation", () => {
    const table = new EventDedupTable({ sweeperIntervalMs: 0 });

    const first = table.reserve(sample);
    expect(first.status).toBe("reserved");

    const second = table.reserve(sample);
    expect(second.status).toBe("duplicate");
    if (second.status === "duplicate") {
      expect(second.entry.status).toBe("pending");
    }

    table.markDone(sample);
    const third = table.reserve(sample);
    expect(third.status).toBe("duplicate");
    if (third.status === "duplicate") {
      expect(third.entry.status).toBe("done");
    }

    table.close();
  });

  it("differentiates keys across eventType, delivery, integration, and team", () => {
    const table = new EventDedupTable({ sweeperIntervalMs: 0 });

    expect(table.reserve(sample).status).toBe("reserved");
    expect(table.reserve({ ...sample, teamId: "team-2" }).status).toBe("reserved");
    expect(table.reserve({ ...sample, integration: "other" }).status).toBe("reserved");
    expect(table.reserve({ ...sample, providerEventId: "delivery-2" }).status).toBe("reserved");
    expect(table.reserve({ ...sample, eventType: "other.event" }).status).toBe("reserved");

    expect(table.size).toBe(5);
    table.close();
  });

  it("returns capacity_exceeded when maxKeys reached", () => {
    const table = new EventDedupTable({ maxKeys: 2, sweeperIntervalMs: 0 });

    expect(table.reserve({ ...sample, providerEventId: "d1" }).status).toBe("reserved");
    expect(table.reserve({ ...sample, providerEventId: "d2" }).status).toBe("reserved");
    expect(table.reserve({ ...sample, providerEventId: "d3" }).status).toBe("capacity_exceeded");

    table.close();
  });

  it("sweeps expired entries", () => {
    const table = new EventDedupTable({ ttlMs: 10, sweeperIntervalMs: 0 });

    table.reserve(sample);
    expect(table.size).toBe(1);

    // Artificially wait or mock time
    const now = Date.now();
    // Re-reserve with an expired timestamp
    (table as unknown as { entries: Map<string, { expiresAt: number; status: string }> })
      .entries.set(EventDedupTable.buildKey(sample), { status: "pending", expiresAt: now - 10 });

    table.sweepExpired();
    expect(table.size).toBe(0);

    table.close();
  });

  it("clears all keys on restart / clear", () => {
    const table = new EventDedupTable({ sweeperIntervalMs: 0 });
    table.reserve(sample);
    expect(table.size).toBe(1);
    table.clear();
    expect(table.size).toBe(0);
    table.close();
  });
});
