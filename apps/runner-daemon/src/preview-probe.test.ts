import { describe, expect, it, vi } from "vitest";

import { probePreview } from "./preview-probe.js";

describe("probePreview", () => {
  it("requires two consecutive successful host responses", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response("", { status: 200 }))
      .mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response("", { status: 200 }));

    await expect(probePreview("http://127.0.0.1:41000", new AbortController().signal, {
      fetchImpl,
      sleepImpl: vi.fn(async () => undefined),
      maxAttempts: 5,
      intervalMs: 0,
    })).resolves.toBe(2);
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  it("fails closed after the bounded attempt count", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 500 }));

    await expect(probePreview("http://127.0.0.1:41001", new AbortController().signal, {
      fetchImpl,
      sleepImpl: vi.fn(async () => undefined),
      maxAttempts: 3,
      intervalMs: 0,
    })).rejects.toThrow("Preview did not become reachable");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("stops immediately when execution is canceled", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn();

    await expect(probePreview("http://127.0.0.1:41002", controller.signal, {
      fetchImpl,
      sleepImpl: vi.fn(async () => undefined),
    })).rejects.toThrow("Preview probe aborted");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
