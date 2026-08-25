import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import { createWorkflowManagementService } from "@/lib/workflows/workflow-management-service-factory";
import { WorkflowFailure } from "@/lib/workflows/workflow-errors";
import { POST as enable } from "./tasks/[id]/workflow/enable/route";
import { POST as disable } from "./tasks/[id]/workflow/disable/route";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/workflows/workflow-management-service-factory", () => ({ createWorkflowManagementService: vi.fn() }));

const teamId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
const taskId = "00000000-0000-4000-8000-000000000003";
const stateId = "00000000-0000-4000-8000-000000000004";
const commandId = "00000000-0000-4000-8000-000000000005";
const timestamp = "2026-08-25T00:00:00.000Z";

function database(role = "owner") {
  return {
    getAuthSessionByTokenHash: vi.fn(async () => ({ id: stateId, userId, tokenHash: "digest", activeTeamId: teamId, expiresAt: "2027-08-25T00:00:00.000Z", createdAt: timestamp, updatedAt: timestamp })),
    getUserById: vi.fn(async () => ({ id: userId, username: "owner", displayUsername: "owner", displayName: "Owner", status: "active", requirePasswordChange: false, createdAt: timestamp, updatedAt: timestamp })),
    resolveActiveTeam: vi.fn(async () => ({ team: { id: teamId, displayName: "Team", status: "active", createdAt: timestamp, updatedAt: timestamp }, role })),
  };
}

function request(path: string, body: unknown, authenticated = true) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(authenticated ? { authorization: "Bearer workflow-route-token" } : {}) },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDb).mockResolvedValue(database() as never);
});

describe("Task Workflow management routes", () => {
  it("forwards only active-Team human authority to enable", async () => {
    const service = { enable: vi.fn(async () => ({ workflow: {
      id: "mystra.workflow", stateId, stageId: "understand", stateVersion: 1,
      active: true, enabledAt: timestamp, disabledAt: null,
    } })) };
    vi.mocked(createWorkflowManagementService).mockReturnValue(service as never);
    const response = await enable(request(`/api/tasks/${taskId}/workflow/enable`, { commandId }), {
      params: Promise.resolve({ id: taskId }),
    });
    expect(response.status).toBe(200);
    expect(service.enable).toHaveBeenCalledWith({
      teamId, taskId, actor: { userId, role: "owner" }, request: { commandId },
    });
  });

  it("maps stable Workflow failures and never leaks another Team's Task", async () => {
    vi.mocked(getDb).mockResolvedValue(database("member") as never);
    vi.mocked(createWorkflowManagementService).mockReturnValue({
      enable: vi.fn(async () => { throw new WorkflowFailure("workflow_forbidden", "Workflow management requires Owner or Admin"); }),
    } as never);
    const response = await enable(request(`/api/tasks/${taskId}/workflow/enable`, { commandId }), {
      params: Promise.resolve({ id: taskId }),
    });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: { code: "workflow_forbidden", message: "Workflow management requires Owner or Admin", retryable: false },
    });
  });

  it("forwards disable CAS and rejects anonymous callers", async () => {
    const service = { disable: vi.fn(async () => ({
      workflow: { id: "mystra.workflow", stateId, stageId: "understand", stateVersion: 2, active: false, enabledAt: timestamp, disabledAt: timestamp },
      projectionCleanup: { status: "ready", retryable: false },
    })) };
    vi.mocked(createWorkflowManagementService).mockReturnValue(service as never);
    const response = await disable(request(`/api/tasks/${taskId}/workflow/disable`, { commandId, expectedStateVersion: 1 }), {
      params: Promise.resolve({ id: taskId }),
    });
    expect(response.status).toBe(200);
    expect(service.disable).toHaveBeenCalledWith(expect.objectContaining({ request: { commandId, expectedStateVersion: 1 } }));
    expect((await disable(request(`/api/tasks/${taskId}/workflow/disable`, { commandId, expectedStateVersion: 1 }, false), {
      params: Promise.resolve({ id: taskId }),
    })).status).toBe(401);
  });
});
