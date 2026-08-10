import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import { POST as claimSession } from "./runner/sessions/claim/route";
import { POST as appendSessionEvents } from "./runner/sessions/[sessionId]/events/route";

const services = vi.hoisted(() => ({
  claim: vi.fn(),
  appendEvents: vi.fn(),
  reconcileExpiredLeases: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/sessions/runtime-session-service-factory", () => ({
  createRuntimeSessionService: vi.fn(() => services),
}));
vi.mock("@/lib/runtime/runtime-liveness", () => ({
  withDerivedHostLiveness: vi.fn((runtime: unknown) => runtime),
}));

const runtimeId = "00000000-0000-4000-8000-000000000001";
const sessionId = "00000000-0000-4000-8000-000000000002";
const teamId = "00000000-0000-4000-8000-000000000003";
const leaseToken = "l".repeat(32);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDb).mockResolvedValue({
    getRuntime: vi.fn(async () => ({ id: runtimeId, status: "online" })),
  } as never);
  services.reconcileExpiredLeases.mockResolvedValue(0);
  services.claim.mockResolvedValue({ session: { id: sessionId } });
  services.appendEvents.mockResolvedValue({ session: { id: sessionId, state: "ready" }, events: [] });
});

describe("Runtime Session routes", () => {
  it("requires Runtime identity, reconciles expiry, and returns an assignment", async () => {
    const unauthenticated = await claimSession(new Request("http://localhost/api/runner/sessions/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runnerId: "runner-1", waitSeconds: 0 }),
    }));
    expect(unauthenticated.status).toBe(401);

    const response = await claimSession(new Request("http://localhost/api/runner/sessions/claim", {
      method: "POST",
      headers: { "content-type": "application/json", "x-mystra-runtime-id": runtimeId },
      body: JSON.stringify({ runnerId: "runner-1", waitSeconds: 0 }),
    }));

    expect(response.status).toBe(200);
    expect(services.reconcileExpiredLeases).toHaveBeenCalledOnce();
    expect(services.claim).toHaveBeenCalledWith({
      runtimeId,
      request: { runnerId: "runner-1", waitSeconds: 0 },
    });
    await expect(response.json()).resolves.toEqual({ assignment: { session: { id: sessionId } } });
  });

  it("returns 204 when no Session is claimable and a secret-safe conflict on failure", async () => {
    services.claim.mockResolvedValueOnce(undefined);
    const empty = await claimSession(new Request("http://localhost/api/runner/sessions/claim", {
      method: "POST",
      headers: { "content-type": "application/json", "x-mystra-runtime-id": runtimeId },
      body: JSON.stringify({ runnerId: "runner-1", waitSeconds: 0 }),
    }));
    expect(empty.status).toBe(204);

    services.claim.mockRejectedValueOnce(new Error("authorization=do-not-leak"));
    const failed = await claimSession(new Request("http://localhost/api/runner/sessions/claim", {
      method: "POST",
      headers: { "content-type": "application/json", "x-mystra-runtime-id": runtimeId },
      body: JSON.stringify({ runnerId: "runner-1", waitSeconds: 0 }),
    }));
    expect(failed.status).toBe(409);
    expect(JSON.stringify(await failed.json())).not.toContain("do-not-leak");
  });

  it("requires matching lease headers and forwards an event batch without logging credentials", async () => {
    const body = { leaseToken, events: [{ kind: "opaque-test" }] };
    const missing = await appendSessionEvents(new Request("http://localhost/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }), { params: Promise.resolve({ sessionId }) });
    expect(missing.status).toBe(401);

    const response = await appendSessionEvents(new Request("http://localhost/events", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-mystra-team-id": teamId,
        "x-mystra-lease-token": leaseToken,
      },
      body: JSON.stringify(body),
    }), { params: Promise.resolve({ sessionId }) });
    expect(response.status).toBe(200);
    expect(services.appendEvents).toHaveBeenCalledWith({
      sessionId,
      teamId,
      leaseToken,
      batch: body,
    });

    services.appendEvents.mockRejectedValueOnce(new Error(`credential=${leaseToken}`));
    const rejected = await appendSessionEvents(new Request("http://localhost/events", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-mystra-team-id": teamId,
        "x-mystra-lease-token": leaseToken,
      },
      body: JSON.stringify(body),
    }), { params: Promise.resolve({ sessionId }) });
    expect(rejected.status).toBe(409);
    expect(JSON.stringify(await rejected.json())).not.toContain(leaseToken);
  });
});
