import { describe, expect, it } from "vitest";

import {
  EventRuntime,
  EventRuntimeOverloadedError,
  EventRuntimeStoppedError,
  type ReceivedWebhookItem,
} from "./event-runtime.js";

function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return (async function poll(): Promise<void> {
    if (predicate()) return;
    if (Date.now() > deadline) throw new Error("condition not met in time");
    await new Promise((resolve) => setTimeout(resolve, 10));
    return poll();
  })();
}

describe("EventRuntime", () => {
function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

  it("admits item and processes asynchronously", async () => {
    const { promise, resolve } = deferred<ReceivedWebhookItem>();
    const runtime = new EventRuntime(async (item) => {
      resolve(item);
    }, { maxItems: 10, maxWorkers: 2, sweeperIntervalMs: 0 });

    const admitted = runtime.admit({
      endpointId: "ep-1",
      connectionId: "conn-1",
      teamId: "team-1",
      integration: "linear",
      headers: { "content-type": "application/json" },
      rawBody: JSON.stringify({ hello: "world" }),
    });

    expect(admitted.endpointId).toBe("ep-1");
    expect(admitted.byteLength).toBeGreaterThan(0);

    const processed = await promise;
    expect(processed.id).toBe(admitted.id);

    await runtime.shutdown();
  });

  it("enforces maxItems bound and throws EventRuntimeOverloadedError", async () => {
    const { promise: blockWorker, resolve: releaseWorker } = deferred<void>();
    const runtime = new EventRuntime(async () => {
      await blockWorker;
    }, { maxItems: 2, maxWorkers: 1, sweeperIntervalMs: 0 });

    runtime.admit({
      endpointId: "ep-1",
      connectionId: "conn-1",
      teamId: "team-1",
      integration: "linear",
      headers: {},
      rawBody: "item1",
    });

    runtime.admit({
      endpointId: "ep-1",
      connectionId: "conn-1",
      teamId: "team-1",
      integration: "linear",
      headers: {},
      rawBody: "item2",
    });

    expect(() =>
      runtime.admit({
        endpointId: "ep-1",
        connectionId: "conn-1",
        teamId: "team-1",
        integration: "linear",
        headers: {},
        rawBody: "item3",
      }),
    ).toThrow(EventRuntimeOverloadedError);

    releaseWorker();
    await runtime.shutdown();
  });

  it("enforces maxBytes bound and throws EventRuntimeOverloadedError", async () => {
    const { promise: blockWorker, resolve: releaseWorker } = deferred<void>();
    const runtime = new EventRuntime(async () => {
      await blockWorker;
    }, { maxBytes: 100, maxWorkers: 1, sweeperIntervalMs: 0 });

    // 80 bytes
    runtime.admit({
      endpointId: "ep-1",
      connectionId: "conn-1",
      teamId: "team-1",
      integration: "linear",
      headers: {},
      rawBody: "a".repeat(80),
    });

    // Another 30 bytes exceeds 100
    expect(() =>
      runtime.admit({
        endpointId: "ep-1",
        connectionId: "conn-1",
        teamId: "team-1",
        integration: "linear",
        headers: {},
        rawBody: "b".repeat(30),
      }),
    ).toThrow(EventRuntimeOverloadedError);

    releaseWorker();
    await runtime.shutdown();
  });

  it("discards expired items on sweep", async () => {
    const processed: string[] = [];
    const runtime = new EventRuntime(async (item) => {
      processed.push(item.id);
    }, { ttlMs: 50, maxWorkers: 1, sweeperIntervalMs: 0 });

    // Admit item with past receivedAt
    runtime.admit({
      endpointId: "ep-1",
      connectionId: "conn-1",
      teamId: "team-1",
      integration: "linear",
      headers: {},
      rawBody: "old-item",
      receivedAt: Date.now() - 100,
    });

    runtime.sweepExpired();
    expect(runtime.stats.queuedCount).toBe(0);
    expect(processed).toHaveLength(0);

    await runtime.shutdown();
  });

  it("stamps the admission subscription-generation cap from the provider", async () => {
    let generation = 7;
    const admitted: ReceivedWebhookItem[] = [];
    const runtime = new EventRuntime(async (item) => {
      admitted.push(item);
    }, { sweeperIntervalMs: 0, currentSubscriptionGeneration: () => generation });

    runtime.admit({
      endpointId: "ep-1",
      connectionId: "conn-1",
      teamId: "team-1",
      integration: "linear",
      headers: {},
      rawBody: "{}",
    });
    generation = 9;
    runtime.admit({
      endpointId: "ep-1",
      connectionId: "conn-1",
      teamId: "team-1",
      integration: "linear",
      headers: {},
      rawBody: "{}",
    });

    await waitFor(() => admitted.length === 2);
    expect(admitted.map((item) => item.subscriptionGenerationCap)).toEqual([7, 9]);

    await runtime.shutdown();
  });

  it("stops admission and rejects new items with EventRuntimeStoppedError", async () => {
    const runtime = new EventRuntime(undefined, { sweeperIntervalMs: 0 });
    runtime.stopAdmission();

    expect(() =>
      runtime.admit({
        endpointId: "ep-1",
        connectionId: "conn-1",
        teamId: "team-1",
        integration: "linear",
        headers: {},
        rawBody: "{}",
      }),
    ).toThrow(EventRuntimeStoppedError);

    await runtime.shutdown();
  });
});
