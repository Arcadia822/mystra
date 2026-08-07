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

beforeEach(() => {
  vi.mocked(getDb).mockResolvedValue({
    listTasks: async () => [task],
  } as never);
});

describe("Control Plane status API", () => {
  it("reports active Task persistence and explicit unavailable surfaces", async () => {
    const response = await getControlPlane();
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
