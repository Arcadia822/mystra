import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import { POST } from "./route";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));

const userId = randomUUID();
const teamId = randomUUID();
const otherTeamId = randomUUID();
const projectId = randomUUID();
const taskId = randomUUID();

function rpcRequest(
  body: unknown,
  token = "mcp-human-session-token",
): Request {
  return new Request("https://control.example.test/api/mcp", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function call(method: string, params?: unknown) {
  return { jsonrpc: "2.0", id: 1, method, ...(params === undefined ? {} : { params }) };
}

function toolCall(name: string, arguments_: Record<string, unknown> = {}) {
  return call("tools/call", { name, arguments: arguments_ });
}

beforeEach(() => {
  vi.mocked(getDb).mockResolvedValue({
    getAuthSessionByTokenHash: vi.fn(async () => ({
      id: randomUUID(),
      userId,
      tokenHash: "digest",
      activeTeamId: teamId,
      expiresAt: "2027-08-07T00:00:00.000Z",
      createdAt: "2026-08-07T00:00:00.000Z",
      updatedAt: "2026-08-07T00:00:00.000Z",
    })),
    getUserById: vi.fn(async () => ({
      id: userId,
      username: "operator",
      displayUsername: "operator",
      displayName: "Operator",
      status: "active",
      requirePasswordChange: false,
      createdAt: "2026-08-07T00:00:00.000Z",
      updatedAt: "2026-08-07T00:00:00.000Z",
    })),
    deleteAuthSession: vi.fn(async () => {}),
    resolveActiveTeam: vi.fn(async () => ({
      team: {
        id: teamId,
        displayName: "Operations",
        status: "active",
        createdAt: "2026-08-07T00:00:00.000Z",
        updatedAt: "2026-08-07T00:00:00.000Z",
      },
      role: "owner",
    })),
    createTask: vi.fn(async (input) => ({
      id: taskId,
      ...input,
      createdAt: "2026-08-07T00:00:00.000Z",
      updatedAt: "2026-08-07T00:00:00.000Z",
    })),
    listTasks: vi.fn(async () => []),
    getTask: vi.fn(async () => undefined),
  } as never);
});

describe("MCP human session authorization", () => {
  it("returns a stable unauthenticated JSON-RPC error without checking tenant resources", async () => {
    const response = await POST(new Request("https://control.example.test/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(call("tools/list")),
    }));

    await expect(response.json()).resolves.toEqual({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32001, message: "Unauthenticated" },
    });
    const db = await getDb();
    expect(db.resolveActiveTeam).not.toHaveBeenCalled();
  });

  it("does not accept an equivalent cookie session for MCP", async () => {
    const response = await POST(new Request("https://control.example.test/api/mcp", {
      method: "POST",
      headers: {
        cookie: "mystra_session=mcp-human-session-token",
        "content-type": "application/json",
      },
      body: JSON.stringify(call("tools/list")),
    }));

    await expect(response.json()).resolves.toEqual({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32001, message: "Unauthenticated" },
    });
  });

  it("applies the password-change gate before resolving an active Team", async () => {
    vi.mocked(getDb).mockResolvedValueOnce({
      ...(await getDb()),
      getUserById: vi.fn(async () => ({
        id: userId,
        username: "operator",
        displayUsername: "operator",
        displayName: "Operator",
        status: "active",
        requirePasswordChange: true,
        createdAt: "2026-08-07T00:00:00.000Z",
        updatedAt: "2026-08-07T00:00:00.000Z",
      })),
    } as never);

    const response = await POST(rpcRequest(call("tools/list")));

    await expect(response.json()).resolves.toEqual({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32002, message: "Password change required" },
    });
    const db = await getDb();
    expect(db.resolveActiveTeam).not.toHaveBeenCalled();
  });

  it("allows a member to list only Tasks for the resolved active Team", async () => {
    const listTasks = vi.fn(async () => [{
      id: taskId,
      teamId,
      projectId,
      metadata: {},
      createdAt: "2026-08-07T00:00:00.000Z",
      updatedAt: "2026-08-07T00:00:00.000Z",
    }]);
    const memberDb: Record<string, unknown> = {
      ...(await getDb()),
      resolveActiveTeam: vi.fn(async () => ({
        team: {
          id: teamId,
          displayName: "Operations",
          status: "active",
          createdAt: "2026-08-07T00:00:00.000Z",
          updatedAt: "2026-08-07T00:00:00.000Z",
        },
        role: "member",
      })),
      listTasks,
    };
    vi.mocked(getDb).mockResolvedValueOnce(memberDb as never);

    const response = await POST(rpcRequest(toolCall("mystra_list_tasks")));

    const payload = await response.json() as { result: { content: Array<{ text: string }> } };
    expect(JSON.parse(payload.result.content[0]!.text)).toEqual({
      tasks: [expect.objectContaining({ teamId })],
    });
    expect(listTasks).toHaveBeenCalledWith({ teamId });
  });

  it("hides a cross-Team Task behind the same not-found tool result", async () => {
    const getTask = vi.fn(async (_id: string, options?: { teamId?: string }) => (
      options?.teamId === otherTeamId
        ? {
          id: taskId,
          teamId: otherTeamId,
          projectId,
          metadata: {},
          createdAt: "2026-08-07T00:00:00.000Z",
          updatedAt: "2026-08-07T00:00:00.000Z",
        }
        : undefined
    ));
    vi.mocked(getDb).mockResolvedValueOnce({
      ...(await getDb()),
      getTask,
    } as never);

    const response = await POST(rpcRequest(toolCall("mystra_get_task", { id: taskId })));

    const payload = await response.json() as { result: { content: Array<{ text: string }> } };
    expect(JSON.parse(payload.result.content[0]!.text)).toEqual({
      error: { code: "TASK_NOT_FOUND", message: `Task not found: ${taskId}` },
    });
    expect(getTask).toHaveBeenCalledWith(taskId, { teamId });
    expect(otherTeamId).not.toBe(teamId);
  });

  it("allows an owner to create a Task in the resolved active Team", async () => {
    const response = await POST(rpcRequest(toolCall("mystra_create_task", {
      projectId,
      metadata: { title: "MCP task" },
    })));

    const payload = await response.json() as { result: { content: Array<{ text: string }> } };
    expect(JSON.parse(payload.result.content[0]!.text)).toEqual({
      task: expect.objectContaining({ id: taskId, teamId, projectId }),
    });
    const db = await getDb();
    expect(db.createTask).toHaveBeenCalledWith({
      projectId,
      metadata: { title: "MCP task" },
      teamId,
    });
  });

  it("reports health totals only for the resolved active Team", async () => {
    const listTasks = vi.fn(async () => [{ id: taskId }, { id: randomUUID() }]);
    vi.mocked(getDb).mockResolvedValueOnce({
      ...(await getDb()),
      listTasks,
    } as never);

    const response = await POST(rpcRequest(toolCall("mystra_health")));

    const payload = await response.json() as { result: { content: Array<{ text: string }> } };
    expect(JSON.parse(payload.result.content[0]!.text)).toMatchObject({
      controlPlane: { status: "healthy" },
      tasks: { total: 2 },
    });
    expect(listTasks).toHaveBeenCalledWith({ teamId });
  });
});
