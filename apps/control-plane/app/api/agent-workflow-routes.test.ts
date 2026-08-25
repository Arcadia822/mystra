import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import { createWorkflowWorkloadService } from "@/lib/workflows/workflow-workload-service-factory";
import { WorkflowFailure } from "@/lib/workflows/workflow-errors";
import { GET as current } from "./agent-execution/workflow/current/route";
import { POST as transition } from "./agent-execution/workflow/transition/route";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/workflows/workflow-workload-service-factory", () => ({ createWorkflowWorkloadService: vi.fn() }));

const commandId = "00000000-0000-4000-8000-000000000001";
const currentPayload = {
  workflow: { id: "mystra.workflow", name: "Mystra Workflow" },
  state: { stageId: "understand", stateVersion: 1, terminal: false },
  stage: { name: "Understand", instructions: "Understand the Task." },
  requiredSkills: [],
  materialization: { workspaceId: "00000000-0000-4000-8000-000000000007", generation: 1, entries: [], removals: [] },
  availableActions: [{ id: "understanding-complete", label: "Understanding complete", nextStageId: "implement" }],
  projection: { generation: 1, status: "ready", retryable: false },
};

function request(path: string, init: RequestInit = {}) {
  return new Request(`http://localhost${path}`, {
    ...init,
    headers: { authorization: "Bearer session-execution-code", ...(init.headers ?? {}) },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDb).mockResolvedValue({} as never);
});

describe("Agent Workflow routes", () => {
  it("resolves current exclusively from the execution code and accepts no object IDs", async () => {
    const service = { current: vi.fn(async () => currentPayload) };
    vi.mocked(createWorkflowWorkloadService).mockReturnValue(service as never);
    const response = await current(request("/api/agent-execution/workflow/current?taskId=ignored"));
    expect(response.status).toBe(200);
    expect(service.current).toHaveBeenCalledWith("session-execution-code");
    expect(JSON.stringify(await response.json())).not.toMatch(/taskId|stateId|execution-code/u);
  });

  it("forwards the strict transition command and returns bounded failures", async () => {
    const service = { transition: vi.fn(async () => ({
      transition: { commandId, actionId: "understanding-complete", previousStageId: "understand", currentStageId: "implement", stateVersion: 2, replayed: false },
      current: {
        ...currentPayload,
        state: { stageId: "implement", stateVersion: 2, terminal: false },
        materialization: { ...currentPayload.materialization, generation: 2 },
        projection: { ...currentPayload.projection, generation: 2 },
        availableActions: [],
      },
      skillChanges: { added: [], removed: [], retained: [] },
    })) };
    vi.mocked(createWorkflowWorkloadService).mockReturnValue(service as never);
    const body = { commandId, actionId: "understanding-complete", expectedStateVersion: 1 };
    const response = await transition(request("/api/agent-execution/workflow/transition", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    }));
    expect(response.status).toBe(200);
    expect(service.transition).toHaveBeenCalledWith("session-execution-code", body);

    vi.mocked(createWorkflowWorkloadService).mockReturnValue({
      transition: vi.fn(async () => { throw new WorkflowFailure("workflow_state_conflict", "Workflow state changed"); }),
    } as never);
    const conflict = await transition(request("/api/agent-execution/workflow/transition", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    }));
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toMatchObject({ error: { code: "workflow_state_conflict", retryable: false } });
  });

  it("fails closed when execution authority is absent", async () => {
    vi.mocked(createWorkflowWorkloadService).mockReturnValue({ current: vi.fn() } as never);
    const response = await current(new Request("http://localhost/api/agent-execution/workflow/current"));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "capability_expired" } });
  });
});
