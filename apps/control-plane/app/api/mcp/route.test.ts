import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TASK_INITIAL_INSTRUCTION } from "@mystra/shared";

import { getDb } from "@/lib/db";
import { POST } from "./route";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
const startProduction = vi.hoisted(() => vi.fn());
const skillServices = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  listRevisions: vi.fn(),
  getRevision: vi.fn(),
  preview: vi.fn(),
  archive: vi.fn(),
}));
const workflowServices = vi.hoisted(() => ({ enable: vi.fn(), disable: vi.fn() }));
vi.mock("@/lib/tasks/task-production-service-factory", () => ({
  createTaskProductionService: vi.fn(() => ({ start: startProduction })),
}));
vi.mock("@/lib/skills/skill-service-factory", () => ({
  createSkillServices: vi.fn(async () => ({
    query: {
      list: skillServices.list,
      get: skillServices.get,
      listRevisions: skillServices.listRevisions,
      getRevision: skillServices.getRevision,
    },
    preview: { preview: skillServices.preview },
    publication: { archive: skillServices.archive },
  })),
}));
vi.mock("@/lib/workflows/workflow-management-service-factory", () => ({
  createWorkflowManagementService: vi.fn(() => workflowServices),
}));

const sessionServices = vi.hoisted(() => ({
  get: vi.fn(),
  list: vi.fn(),
  sendMessage: vi.fn(),
}));

vi.mock("@/lib/sessions/session-service-factory", () => ({
  createSessionService: vi.fn(() => sessionServices),
}));

const userId = randomUUID();
const teamId = randomUUID();
const otherTeamId = randomUUID();
const projectId = randomUUID();
const taskId = randomUUID();
const agentId = randomUUID();
const runtimeId = randomUUID();
const task = {
  id: taskId,
  teamId,
  title: "MCP Task",
  description: null,
  projectId: null,
  issue: null,
  status: "pending" as const,
  metadata: {},
  statusRevision: 1,
  statusNote: null,
  statusUpdatedAt: "2026-08-07T00:00:00.000Z",
  statusActor: { kind: "system" as const, actorId: null, agentId: null, executionContextId: null, sessionId: null },
  createdAt: "2026-08-07T00:00:00.000Z",
  updatedAt: "2026-08-07T00:00:00.000Z",
};

const agent = {
  id: agentId,
  teamId,
  name: "Reviewer",
  systemPrompt: "Review evidence.",
  revision: 1,
  status: "active" as const,
  archivedAt: null,
  createdAt: "2026-08-07T00:00:00.000Z",
  updatedAt: "2026-08-07T00:00:00.000Z",
};

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
  startProduction.mockReset();
  startProduction.mockResolvedValue({
    task: { ...task, status: "in_progress", statusRevision: 2 },
    transition: { id: randomUUID(), teamId, taskId, fromStatus: "pending", toStatus: "in_progress", revision: 2, actor: { kind: "human", actorId: userId, agentId: null, executionContextId: randomUUID(), sessionId: null }, note: null, idempotencyKey: "start-mcp-1", requestFingerprint: "a".repeat(64), occurredAt: "2026-08-07T00:00:00.000Z" },
    executionContext: { id: randomUUID(), teamId, taskId, projectId, agentId: null, agentName: null, agentRevision: null, agentSystemPrompt: null, taskTitle: task.title, taskDescription: null, taskIssue: null, initialInstruction: "Write the design document.", runtimeId, providerKey: "codex", workspaceId: null, plannedSessionId: randomUUID(), sessionId: null, firstMessageId: randomUUID(), assignIdempotencyKey: "start-mcp-1", assignRequestFingerprint: "a".repeat(64), capabilityRevokedAt: null, setupFailureCode: null, setupFailureMessage: null, createdAt: "2026-08-07T00:00:00.000Z", updatedAt: "2026-08-07T00:00:00.000Z" },
    created: true,
  });
  for (const mock of Object.values(skillServices)) mock.mockReset();
  for (const mock of Object.values(workflowServices)) mock.mockReset();
  skillServices.list.mockResolvedValue({ items: [], nextCursor: null });
  skillServices.get.mockResolvedValue({ id: randomUUID(), name: "reviewer" });
  skillServices.listRevisions.mockResolvedValue({ items: [], nextCursor: null });
  skillServices.getRevision.mockResolvedValue({ id: randomUUID(), sequence: 1 });
  skillServices.preview.mockResolvedValue({ revisionId: randomUUID(), sequence: 1, content: "# Reviewer" });
  skillServices.archive.mockResolvedValue({ id: randomUUID(), status: "archived", resourceRevision: 2 });
  workflowServices.enable.mockResolvedValue({ workflow: { id: "mystra.workflow", active: true } });
  workflowServices.disable.mockResolvedValue({ workflow: { id: "mystra.workflow", active: false }, projectionCleanup: { status: "ready", retryable: false } });
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
      task: {
        ...task,
        teamId: input.teamId,
        title: input.title,
        description: input.description,
        projectId: input.projectId,
      },
      created: true,
    })),
    listTasks: vi.fn(async () => []),
    getTask: vi.fn(async () => undefined),
    updateTask: vi.fn(async (_id, input) => ({ ...task, ...input })),
    createAgent: vi.fn(async (input) => ({ ...agent, ...input })),
    listAgents: vi.fn(async () => ({ agents: [agent], nextCursor: null })),
    getAgent: vi.fn(async () => agent),
    updateAgent: vi.fn(async (_id, input) => ({
      ...agent,
      ...(input.name ? { name: input.name } : {}),
      ...(input.systemPrompt ? { systemPrompt: input.systemPrompt } : {}),
      revision: input.systemPrompt ? 2 : agent.revision,
    })),
    archiveAgent: vi.fn(async () => ({
      ...agent,
      status: "archived",
      archivedAt: "2026-08-07T01:00:00.000Z",
    })),
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
      ...task,
      projectId,
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
          ...task,
          teamId: otherTeamId,
          projectId,
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
      title: "MCP Task",
      projectId,
      idempotencyKey: "00000000-0000-4000-8000-000000000090",
    })));

    const payload = await response.json() as { result: { content: Array<{ text: string }> } };
    expect(JSON.parse(payload.result.content[0]!.text)).toEqual({
      task: expect.objectContaining({ id: taskId, teamId, projectId }),
      created: true,
    });
    const db = await getDb();
    expect(db.createTask).toHaveBeenCalledWith({
      projectId,
      title: "MCP Task",
      description: null,
      metadata: {},
      idempotencyKey: "00000000-0000-4000-8000-000000000090",
      teamId,
    });
  });

  it("updates only Task-owned content and rejects execution fields", async () => {
    const response = await POST(rpcRequest(toolCall("mystra_update_task", {
      id: taskId,
      title: "Updated MCP Task",
    })));
    const payload = await response.json() as { result: { content: Array<{ text: string }> } };
    expect(JSON.parse(payload.result.content[0]!.text)).toEqual({
      task: expect.objectContaining({ id: taskId, title: "Updated MCP Task", projectId: null }),
    });

    const invalid = await POST(rpcRequest(toolCall("mystra_update_task", {
      id: taskId,
      provider: "codex",
    })));
    await expect(invalid.json()).resolves.toMatchObject({ error: { code: -32602 } });
  });

  it("lists and calls canonical Start production without Agent Context", async () => {
    const listed = await POST(rpcRequest(call("tools/list")));
    const listedPayload = await listed.json() as { result: { tools: Array<{ name: string; inputSchema: { required?: string[]; properties?: Record<string, unknown> } }> } };
    const tool = listedPayload.result.tools.find(({ name }) => name === "mystra_start_task_production");
    expect(tool?.inputSchema.required).not.toContain("agentId");
    expect(tool?.inputSchema.required).not.toContain("initialInstruction");
    expect(tool?.inputSchema.properties).toHaveProperty("initialInstruction");

    const response = await POST(rpcRequest(toolCall("mystra_start_task_production", {
      taskId,
      runtimeId,
      providerKey: "codex",
      expectedRevision: 1,
      idempotencyKey: "start-mcp-1",
    })));
    expect(response.status).toBe(200);
    expect(startProduction).toHaveBeenCalledWith({
      actor: { actorId: userId, teamId },
      taskId,
      request: {
        agentId: null,
        runtimeId,
        providerKey: "codex",
        expectedRevision: 1,
        idempotencyKey: "start-mcp-1",
        initialInstruction: DEFAULT_TASK_INITIAL_INSTRUCTION,
      },
    });

    await POST(rpcRequest(toolCall("mystra_start_task_production", {
      taskId,
      runtimeId,
      providerKey: "codex",
      expectedRevision: 1,
      idempotencyKey: "start-mcp-2",
      initialInstruction: "Write the design document about the Runtime boundary.",
    })));
    expect(startProduction).toHaveBeenLastCalledWith({
      actor: { actorId: userId, teamId },
      taskId,
      request: {
        agentId: null,
        runtimeId,
        providerKey: "codex",
        expectedRevision: 1,
        idempotencyKey: "start-mcp-2",
        initialInstruction: "Write the design document about the Runtime boundary.",
      },
    });
  });

  it("exposes only enable/disable for the fixed Task Workflow", async () => {
    const commandId = randomUUID();
    const listed = await POST(rpcRequest(call("tools/list")));
    const listedPayload = await listed.json() as { result: { tools: Array<{ name: string }> } };
    const names = listedPayload.result.tools.map(({ name }) => name).filter((name) => name.includes("workflow"));
    expect(names).toEqual(["mystra_task_workflow_enable", "mystra_task_workflow_disable"]);
    expect(names.some((name) => /list|resource|replace|switch|plugin|harness/u.test(name))).toBe(false);

    await POST(rpcRequest(toolCall("mystra_task_workflow_enable", { taskId, commandId })));
    expect(workflowServices.enable).toHaveBeenCalledWith({
      teamId, taskId, actor: { userId, role: "owner" }, request: { commandId },
    });
    await POST(rpcRequest(toolCall("mystra_task_workflow_disable", { taskId, commandId, expectedStateVersion: 2 })));
    expect(workflowServices.disable).toHaveBeenCalledWith({
      teamId, taskId, actor: { userId, role: "owner" }, request: { commandId, expectedStateVersion: 2 },
    });
  });

  it("exposes only JSON-safe Skill tools and calls them in the active Team", async () => {
    const skillId = randomUUID();
    const revisionId = randomUUID();
    const listed = await POST(rpcRequest(call("tools/list")));
    const listedPayload = await listed.json() as { result: { tools: Array<{ name: string; description: string }> } };
    const skillTools = listedPayload.result.tools.filter(({ name }) => name.startsWith("skill"));
    expect(skillTools.map(({ name }) => name)).toEqual([
      "skills_list",
      "skill_get",
      "skill_revisions_list",
      "skill_revision_get",
      "skill_file_preview",
      "skill_archive",
    ]);
    expect(skillTools.some(({ name }) => /upload|publish|download/u.test(name))).toBe(false);
    expect(skillTools.map(({ description }) => description).join(" ")).toContain("mystra skills upload");

    const calls = [
      toolCall("skills_list", { includeArchived: true }),
      toolCall("skill_get", { skillId }),
      toolCall("skill_revisions_list", { skillId }),
      toolCall("skill_revision_get", { skillId, revisionId }),
      toolCall("skill_file_preview", { skillId, revisionId, path: "SKILL.md" }),
      toolCall("skill_archive", { skillId, expectedRevision: 1 }),
    ];
    for (const request of calls) {
      const response = await POST(rpcRequest(request));
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toHaveProperty("result.content.0.type", "text");
    }

    expect(skillServices.list).toHaveBeenCalledWith(expect.objectContaining({ teamId, includeArchived: true }));
    expect(skillServices.get).toHaveBeenCalledWith({ teamId, skillId });
    expect(skillServices.get).toHaveBeenCalledTimes(2);
    expect(skillServices.listRevisions).toHaveBeenCalledWith(expect.objectContaining({ teamId, skillId }));
    expect(skillServices.getRevision).toHaveBeenCalledWith({ teamId, skillId, revisionId });
    expect(skillServices.preview).toHaveBeenCalledWith({ teamId, skillId, revisionId, path: "SKILL.md" });
    expect(skillServices.archive).toHaveBeenCalledWith({
      teamId,
      skillId,
      expectedResourceRevision: 1,
      archivedByUserId: userId,
    });
  });

  it("manages Agents through the resolved active Team", async () => {
    const createdResponse = await POST(rpcRequest(toolCall("mystra_create_agent", {
      name: "Reviewer",
      systemPrompt: "Review evidence.",
    })));
    const createdPayload = await createdResponse.json() as { result: { content: Array<{ text: string }> } };
    expect(JSON.parse(createdPayload.result.content[0]!.text)).toEqual({ agent });

    const listedResponse = await POST(rpcRequest(toolCall("mystra_list_agents", { limit: 10 })));
    const listedPayload = await listedResponse.json() as { result: { content: Array<{ text: string }> } };
    expect(JSON.parse(listedPayload.result.content[0]!.text)).toEqual({ agents: [agent], nextCursor: null });

    const updatedResponse = await POST(rpcRequest(toolCall("mystra_update_agent", {
      id: agentId,
      expectedRevision: 1,
      systemPrompt: "Reject unsupported claims.",
    })));
    const updatedPayload = await updatedResponse.json() as { result: { content: Array<{ text: string }> } };
    expect(JSON.parse(updatedPayload.result.content[0]!.text)).toEqual({
      agent: expect.objectContaining({ id: agentId, revision: 2, systemPrompt: "Reject unsupported claims." }),
    });

    const db = await getDb();
    expect(db.createAgent).toHaveBeenCalledWith({
      teamId,
      name: "Reviewer",
      systemPrompt: "Review evidence.",
    });
    expect(db.listAgents).toHaveBeenCalledWith({ teamId, limit: 10, includeArchived: false });
  });

  it("denies Agent mutation to a Team member while preserving read access", async () => {
    vi.mocked(getDb).mockResolvedValueOnce({
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
    } as never);

    const response = await POST(rpcRequest(toolCall("mystra_create_agent", {
      name: "Forbidden",
      systemPrompt: "No.",
    })));
    await expect(response.json()).resolves.toMatchObject({
      error: { code: -32003, message: "Forbidden" },
    });
  });

  it("denies Skill archive to a Team member while preserving Skill read access", async () => {
    vi.mocked(getDb).mockResolvedValue({
      ...(await getDb()),
      resolveActiveTeam: vi.fn(async () => ({
        team: { id: teamId, displayName: "Operations", status: "active", createdAt: "2026-08-07T00:00:00.000Z", updatedAt: "2026-08-07T00:00:00.000Z" },
        role: "member",
      })),
    } as never);
    const skillId = randomUUID();
    const readable = await POST(rpcRequest(toolCall("skill_get", { skillId })));
    expect(readable.status).toBe(200);
    const archived = await POST(rpcRequest(toolCall("skill_archive", { skillId, expectedRevision: 1 })));
    await expect(archived.json()).resolves.toMatchObject({ error: { code: -32003, message: "Forbidden" } });
    expect(skillServices.archive).not.toHaveBeenCalled();
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
  it("provides mystra_get_session, mystra_list_task_sessions, and mystra_send_session_message tools", async () => {
    const sessionId = randomUUID();
    const sessionObj = {
      id: sessionId,
      teamId,
      taskId,
      projectId: null,
      runtimeId,
      providerKey: "codex",
      agentId: null,
      agentRevision: null,
      state: "ready" as const,
      activeMessageId: null,
      lastMessageId: null,
      interruptKind: null,
      continuationMode: null,
      failureCode: null,
      metadata: {},
      createdAt: "2026-08-07T00:00:00.000Z",
      updatedAt: "2026-08-07T00:00:00.000Z",
    };

    sessionServices.get.mockResolvedValueOnce(sessionObj);
    const getRes = await POST(rpcRequest(toolCall("mystra_get_session", { id: sessionId })));
    expect(getRes.status).toBe(200);
    const getPayload = await getRes.json() as { result: { content: Array<{ text: string }> } };
    expect(JSON.parse(getPayload.result.content[0]!.text)).toEqual({ session: sessionObj });
    expect(sessionServices.get).toHaveBeenCalledWith(expect.objectContaining({ sessionId }));

    sessionServices.list.mockResolvedValueOnce([sessionObj]);
    const listRes = await POST(rpcRequest(toolCall("mystra_list_task_sessions", { taskId })));
    expect(listRes.status).toBe(200);
    const listPayload = await listRes.json() as { result: { content: Array<{ text: string }> } };
    expect(JSON.parse(listPayload.result.content[0]!.text)).toEqual({ sessions: [sessionObj] });

    sessionServices.sendMessage.mockResolvedValueOnce({
      session: sessionObj,
      created: true,
      delivery: "dispatch",
      messageId: randomUUID(),
    });
    const sendRes = await POST(rpcRequest(toolCall("mystra_send_session_message", {
      sessionId,
      content: "Continue working",
    })));
    expect(sendRes.status).toBe(200);
    const sendPayload = await sendRes.json() as { result: { content: Array<{ text: string }> } };
    expect(JSON.parse(sendPayload.result.content[0]!.text)).toMatchObject({ created: true, delivery: "dispatch" });
  });
});
