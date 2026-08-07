import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import { GET as getControlPlane } from "./control-plane/route";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));

const task = {
  id: "00000000-0000-4000-8000-000000000010",
  projectId: "00000000-0000-4000-8000-000000000001",
  metadata: { title: "Implement the slice" },
  createdAt: "2026-08-03T11:30:00.000Z",
  updatedAt: "2026-08-03T12:00:00.000Z",
};
const teamId = "00000000-0000-4000-8000-000000000020";
const userId = "00000000-0000-4000-8000-000000000021";

beforeEach(() => {
  vi.mocked(getDb).mockResolvedValue({
    listTasks: async () => [task],
    getAuthSessionByTokenHash: async () => ({
      id: "00000000-0000-4000-8000-000000000022",
      userId,
      tokenHash: "digest",
      activeTeamId: teamId,
      expiresAt: "2027-08-03T00:00:00.000Z",
      createdAt: "2026-08-03T00:00:00.000Z",
      updatedAt: "2026-08-03T00:00:00.000Z",
    }),
    getUserById: async () => ({
      id: userId,
      username: "operator",
      displayUsername: "operator",
      displayName: "Operator",
      status: "active",
      requirePasswordChange: false,
      createdAt: "2026-08-03T00:00:00.000Z",
      updatedAt: "2026-08-03T00:00:00.000Z",
    }),
    resolveActiveTeam: async () => ({
      team: {
        id: teamId,
        displayName: "Primary",
        status: "active",
        createdAt: "2026-08-03T00:00:00.000Z",
        updatedAt: "2026-08-03T00:00:00.000Z",
      },
      role: "owner",
    }),
  } as never);
});

describe("Control Plane status API", () => {
  it("reports active Task persistence and explicit unavailable surfaces", async () => {
    const response = await getControlPlane(new Request("https://control.example.test/api/control-plane", {
      headers: { authorization: "Bearer object-page-route-token" },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      controlPlane: {
        status: "ready",
        tasks: { total: 1 },
        temporarilyUnavailable: ["sessions", "runners", "contextBundles"],
        recentTasks: [{ id: task.id }],
      },
    });
  });
});
