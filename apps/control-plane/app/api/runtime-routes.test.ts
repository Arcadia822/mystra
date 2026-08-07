import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import { GET as getRuntime, PATCH as renameRuntime } from "./runtimes/[id]/route";
import { GET as listRuntimes } from "./runtimes/route";
import { POST as heartbeat } from "./runner/heartbeat/route";
import { POST as reportProviders } from "./runner/providers/route";
import { POST as registerRuntime } from "./runner/register/route";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));

const teamId = randomUUID();
const userId = randomUUID();
const runnerId = randomUUID();
const runtimeId = randomUUID();
const now = "2026-08-07T10:00:00.000Z";

const runtime = {
  id: runtimeId,
  name: "Build host",
  type: "host" as const,
  metadata: { runnerId, platform: "darwin/arm64" },
  status: "offline" as const,
  lastSeenAt: null,
  providers: [],
  createdAt: now,
  updatedAt: now,
};

function runnerRequest(path: string, body: unknown): Request {
  return new Request(`https://control.example.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function managementRequest(path: string, method = "GET", body?: unknown): Request {
  return new Request(`https://control.example.test${path}`, {
    method,
    headers: {
      authorization: "Bearer runtime-route-test-token",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

beforeEach(() => {
  vi.mocked(getDb).mockResolvedValue({
    getAuthSessionByTokenHash: vi.fn(async () => ({
      id: randomUUID(),
      userId,
      tokenHash: "digest",
      activeTeamId: teamId,
      expiresAt: "2027-08-07T00:00:00.000Z",
      createdAt: now,
      updatedAt: now,
    })),
    getUserById: vi.fn(async () => ({
      id: userId,
      username: "operator",
      displayUsername: "operator",
      displayName: "Operator",
      status: "active" as const,
      requirePasswordChange: false,
      createdAt: now,
      updatedAt: now,
    })),
    resolveActiveTeam: vi.fn(async () => ({
      team: {
        id: teamId,
        displayName: "Primary",
        status: "active" as const,
        createdAt: now,
        updatedAt: now,
      },
      role: "owner" as const,
    })),
    registerHostRuntime: vi.fn(async () => runtime),
    listRuntimes: vi.fn(async () => [runtime]),
    getRuntime: vi.fn(async (id: string) => id === runtimeId ? runtime : undefined),
    renameRuntime: vi.fn(async (id: string, input: { name: string }) => (
      id === runtimeId ? { ...runtime, name: input.name } : undefined
    )),
    reportHostProviders: vi.fn(async (id: string) => id === runnerId ? runtime : undefined),
  } as never);
});

describe("host Runtime routes", () => {
  it("registers an unauthenticated host Runtime and records server-side liveness", async () => {
    const response = await registerRuntime(runnerRequest("/api/runner/register", {
      runnerId,
      name: "Build host",
      type: "host",
      platform: "darwin/arm64",
      providers: [],
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ runtimeId });
    const db = await getDb();
    expect(db.registerHostRuntime).toHaveBeenCalledWith(expect.objectContaining({ runnerId }));

    const listed = await listRuntimes(managementRequest("/api/runtimes"));
    await expect(listed.json()).resolves.toEqual({
      runtimes: [expect.objectContaining({
        id: runtimeId,
        status: "online",
        lastSeenAt: expect.any(String),
      })],
    });
  });

  it("rejects an invalid host Runtime registration payload", async () => {
    const response = await registerRuntime(runnerRequest("/api/runner/register", {
      runnerId,
      type: "host",
      platform: "darwin/arm64",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INVALID_HOST_RUNTIME_REGISTRATION",
        message: "Invalid host Runtime registration payload",
      },
    });
  });

  it("requires a human session to list management Runtimes", async () => {
    const response = await listRuntimes(new Request("https://control.example.test/api/runtimes"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: "unauthenticated", message: "unauthenticated" },
    });
  });

  it("reads a Runtime and renames it without offering deletion", async () => {
    const detail = await getRuntime(managementRequest(`/api/runtimes/${runtimeId}`), {
      params: Promise.resolve({ id: runtimeId }),
    });
    expect(detail.status).toBe(200);
    await expect(detail.json()).resolves.toEqual(
      expect.objectContaining({
        runtime: expect.objectContaining({ id: runtimeId, status: expect.any(String) }),
      }),
    );

    const renamed = await renameRuntime(
      managementRequest(`/api/runtimes/${runtimeId}`, "PATCH", { name: "Renamed host" }),
      { params: Promise.resolve({ id: runtimeId }) },
    );
    expect(renamed.status).toBe(200);
    await expect(renamed.json()).resolves.toEqual({
      runtime: expect.objectContaining({ id: runtimeId, name: "Renamed host" }),
    });
    const db = await getDb();
    expect(db.renameRuntime).toHaveBeenCalledWith(runtimeId, { name: "Renamed host" });
  });

  it("uses a heartbeat only for known in-memory liveness and never accesses persistence", async () => {
    await registerRuntime(runnerRequest("/api/runner/register", {
      runnerId,
      name: "Build host",
      type: "host",
      platform: "darwin/arm64",
      providers: [],
    }));
    vi.mocked(getDb).mockClear();

    const response = await heartbeat(runnerRequest("/api/runner/heartbeat", { runnerId }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      acknowledgedAt: expect.any(String),
    });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown heartbeat so the runner re-registers", async () => {
    const response = await heartbeat(runnerRequest("/api/runner/heartbeat", {
      runnerId: randomUUID(),
    }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: "RUNNER_NOT_FOUND", message: "Runner not found" },
    });
  });

  it("replaces the reported Provider set and refreshes liveness", async () => {
    const providers = [{
      provider: "copilot",
      discovered: true,
      available: true,
      source: "path",
      resolvedPath: "/usr/local/bin/copilot",
      version: "1.0.0",
      unavailableReason: null,
    }];
    const response = await reportProviders(runnerRequest("/api/runner/providers", {
      runnerId,
      providers,
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      runtime: expect.objectContaining({ id: runtimeId }),
    });
    const db = await getDb();
    expect(db.reportHostProviders).toHaveBeenCalledWith(runnerId, providers);
  });
});
