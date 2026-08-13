import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import { POST as start } from "./tasks/[id]/production/start/route";
import { GET as getProduction } from "./tasks/[id]/production/route";
import { GET as getHumanStatus, POST as setHumanStatus } from "./tasks/[id]/production/status/route";
import { GET as whoami } from "./agent-execution/whoami/route";
import { GET as context } from "./agent-execution/context/route";
import { GET as getAgentStatus, POST as setAgentStatus } from "./agent-execution/task-status/route";

const services = vi.hoisted(() => ({
  start: vi.fn(), humanGet: vi.fn(), humanSet: vi.fn(),
  whoami: vi.fn(), context: vi.fn(), agentGet: vi.fn(), agentSet: vi.fn(),
  workspaceGet: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/tasks/task-production-service-factory", () => ({ createTaskProductionService: vi.fn(() => ({ start: services.start })) }));
vi.mock("@/lib/tasks/task-status-service-factory", () => ({ createTaskStatusService: vi.fn(() => ({ get: services.humanGet, transition: services.humanSet })) }));
vi.mock("@/lib/tasks/agent-execution-service-factory", () => ({ createAgentExecutionService: vi.fn(() => ({ whoami: services.whoami, context: services.context, taskStatus: services.agentGet, setTaskStatus: services.agentSet })) }));
vi.mock("@/lib/task-workspaces/task-workspace-service-factory", () => ({ createTaskWorkspaceService: vi.fn(() => ({ get: services.workspaceGet })) }));

const teamId = randomUUID();
const userId = randomUUID();
const taskId = randomUUID();
const harnessId = randomUUID();
const sessionId = randomUUID();
const agentId = randomUUID();
const projectId = randomUUID();
const runtimeId = randomUUID();
const timestamp = "2026-08-11T00:00:00.000Z";
const task = {
  id: taskId, teamId, title: "Task", description: null, projectId, issue: null,
  productionStatus: "in_progress" as const, statusRevision: 2, statusNote: null, statusUpdatedAt: timestamp,
  statusActor: { kind: "human" as const, actorId: userId, agentId: null, harnessId, sessionId: null },
  createdAt: timestamp, updatedAt: timestamp,
};

function database() {
  return {
    getAuthSessionByTokenHash: vi.fn(async () => ({ id: randomUUID(), userId, tokenHash: "digest", activeTeamId: teamId, expiresAt: "2027-08-11T00:00:00.000Z", createdAt: timestamp, updatedAt: timestamp })),
    getUserById: vi.fn(async () => ({ id: userId, username: "owner", displayUsername: "owner", displayName: "Owner", status: "active", requirePasswordChange: false, createdAt: timestamp, updatedAt: timestamp })),
    resolveActiveTeam: vi.fn(async () => ({ team: { id: teamId, displayName: "Team", status: "active", createdAt: timestamp, updatedAt: timestamp }, role: "owner" })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDb).mockResolvedValue(database() as never);
  services.start.mockResolvedValue({
    task,
    transition: { id: randomUUID(), teamId, taskId, fromStatus: "pending", toStatus: "in_progress", revision: 2, actor: task.statusActor, note: null, idempotencyKey: "assign-1", requestFingerprint: "a".repeat(64), occurredAt: timestamp },
    harness: { id: harnessId, teamId, taskId, projectId, agentId: null, agentName: null, agentRevision: null, agentSystemPrompt: null, taskTitle: "Task", taskDescription: null, taskIssue: null, runtimeId, providerKey: "codex", workspaceId: null, plannedSessionId: sessionId, sessionId: null, firstMessageId: randomUUID(), assignIdempotencyKey: "start-1", assignRequestFingerprint: "a".repeat(64), capabilityRevokedAt: null, setupFailureCode: null, setupFailureMessage: null, createdAt: timestamp, updatedAt: timestamp },
    created: true,
  });
  services.humanGet.mockResolvedValue({ taskId, productionStatus: "in_progress", statusRevision: 2, statusNote: null, statusUpdatedAt: timestamp, allowedTransitions: ["canceled"] });
  services.humanSet.mockResolvedValue({ taskId, productionStatus: "canceled", statusRevision: 3, statusUpdatedAt: timestamp, transitionId: randomUUID() });
  const execution = { teamId, taskId, harnessId, sessionId, agentContext: null, expiresAt: "2026-08-11T02:00:00.000Z" };
  services.whoami.mockResolvedValue({ version: 1, execution, capabilities: ["context:read", "task-status:read", "task-status:transition"] });
  services.context.mockResolvedValue({ version: 1, execution, task: { title: "Task", description: null, issue: null }, project: { id: projectId, repositoryConnectionId: randomUUID(), repositoryExternalId: "R_repo", repositoryBaseBranch: "main" }, workspace: { id: randomUUID(), branch: "task-branch" }, capabilities: ["context:read", "task-status:read", "task-status:transition"] });
  services.agentGet.mockResolvedValue({ taskId, productionStatus: "in_progress", statusRevision: 2, statusNote: null, statusUpdatedAt: timestamp, allowedTransitions: ["blocked", "waiting_for_review"] });
  services.agentSet.mockResolvedValue({ taskId, productionStatus: "blocked", statusRevision: 3, statusUpdatedAt: timestamp, transitionId: randomUUID() });
  services.workspaceGet.mockResolvedValue(undefined);
});

describe("Task production routes", () => {
  it("authorizes Human Start without Agent Context and status mutations through the active Team", async () => {
    const request = (url: string, body: unknown) => new Request(url, { method: "POST", headers: { authorization: "Bearer human-production-token-051", "content-type": "application/json" }, body: JSON.stringify(body) });
    const started = await start(request("http://localhost/start", { runtimeId, providerKey: "codex", expectedRevision: 1, idempotencyKey: "start-1" }), { params: Promise.resolve({ id: taskId }) });
    expect(started.status).toBe(200);
    expect(started.headers.get("cache-control")).toBe("no-store");
    expect(services.start).toHaveBeenCalledWith(expect.objectContaining({ actor: { actorId: userId, teamId }, taskId, request: expect.not.objectContaining({ agentId: expect.anything() }) }));
    const status = await setHumanStatus(request("http://localhost/status", { status: "canceled", expectedRevision: 2, idempotencyKey: "cancel-1" }), { params: Promise.resolve({ id: taskId }) });
    expect(status.status).toBe(200);
    expect(services.humanSet).toHaveBeenCalledWith(expect.objectContaining({ actorPolicy: "human", taskId }));
    expect((await getHumanStatus(new Request("http://localhost/status", { headers: { authorization: "Bearer human-production-token-051" } }), { params: Promise.resolve({ id: taskId }) })).status).toBe(200);
  });

  it("requires an execution bearer and never accepts a Task ID for workload addressing", async () => {
    expect((await whoami(new Request("http://localhost/whoami"))).status).toBe(401);
    const request = (url: string, method = "GET", body?: unknown) => new Request(url, { method, headers: { authorization: "Bearer execution-code", ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    expect((await whoami(request("http://localhost/whoami"))).status).toBe(200);
    expect((await context(request("http://localhost/context?taskId=foreign"))).status).toBe(200);
    expect((await getAgentStatus(request("http://localhost/task-status?taskId=foreign"))).status).toBe(200);
    const changed = await setAgentStatus(request("http://localhost/task-status", "POST", { status: "blocked", expectedRevision: 2, idempotencyKey: "cmd-1", note: "Waiting" }));
    expect(changed.status).toBe(200);
    expect(services.whoami).toHaveBeenCalledWith("execution-code");
    expect(services.agentSet).toHaveBeenCalledWith("execution-code", expect.not.objectContaining({ taskId: expect.anything() }));
  });

  it("presents Task and latest Session states independently and labels Agent notes as unverified", async () => {
    const reportedTask = {
      ...task,
      productionStatus: "waiting_for_review" as const,
      statusRevision: 3,
      statusNote: "PR: https://example.test/pull/7; tests: pass",
      statusActor: { kind: "agent" as const, actorId: null, agentId, harnessId, sessionId },
    };
    const harness = (await services.start()).harness;
    vi.mocked(getDb).mockResolvedValue({
      ...database(),
      getTask: vi.fn(async () => reportedTask),
      getHarnessByTaskId: vi.fn(async () => harness),
      listTaskStatusTransitions: vi.fn(async () => [{
        id: randomUUID(), teamId, taskId, fromStatus: "in_progress", toStatus: "waiting_for_review", revision: 3,
        actor: reportedTask.statusActor, note: reportedTask.statusNote, idempotencyKey: "delivery-1",
        requestFingerprint: "b".repeat(64), occurredAt: timestamp,
      }]),
      listSessions: vi.fn(async () => [{ id: sessionId, state: "failed" }]),
      listSessionEvents: vi.fn(async () => ({ events: [{
        kind: "session.system_prompt_configured",
        payload: {
          standardPrompt: { version: `sha256:${"a".repeat(64)}`, content: "Standard" },
          agentContext: null,
          components: [
            { name: "standard", content: "Standard" },
            { name: "runtime", content: "Runtime" },
            { name: "provider", content: "Provider" },
            { name: "execution_context", content: "Context" },
          ],
          finalPrompt: "Frozen prompt",
        },
      }] })),
    } as never);

    const response = await getProduction(
      new Request("http://localhost/production", { headers: { authorization: "Bearer human-production-token-051" } }),
      { params: Promise.resolve({ id: taskId }) },
    );
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload.task.productionStatus).toBe("waiting_for_review");
    expect(payload.latestSession.state).toBe("failed");
    expect(payload.promptEvidence).toEqual({
      standardPrompt: { version: `sha256:${"a".repeat(64)}` },
      agentContext: null,
    });
    expect(payload.agentReport).toEqual({
      text: reportedTask.statusNote,
      verified: false,
      label: "Agent reported / not verified by Mystra",
    });
    expect(payload.transitions).toHaveLength(1);
  });
});
