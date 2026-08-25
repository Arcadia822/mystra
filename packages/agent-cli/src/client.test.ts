import { describe, expect, it } from "vitest";

import { AgentExecutionClient } from "./client.js";

describe("AgentExecutionClient", () => {
  it("calls Workflow endpoints without caller-selected object identities", async () => {
    const commandId = "00000000-0000-4000-8000-000000000001";
    const client = new AgentExecutionClient({
      endpoint: "http://localhost:3000", executionCode: "execution-code",
      fetch: (async (url, init) => {
        expect(String(url)).toContain("/api/agent-execution/workflow/transition");
        expect(JSON.parse(String(init?.body))).toEqual({ commandId, actionId: "understanding-complete", expectedStateVersion: 1 });
        return Response.json({
          transition: { commandId, actionId: "understanding-complete", previousStageId: "understand", currentStageId: "implement", stateVersion: 2, replayed: false },
          current: { workflow: { id: "mystra.workflow", name: "Mystra Workflow" }, state: { stageId: "implement", stateVersion: 2, terminal: false }, stage: { name: "Implement", instructions: "Implement." }, requiredSkills: [], materialization: { workspaceId: "00000000-0000-4000-8000-000000000007", generation: 2, entries: [], removals: [] }, availableActions: [], projection: { generation: 2, status: "ready", retryable: false } },
          skillChanges: { added: [], removed: [], retained: [] },
        });
      }) as typeof fetch,
    });
    await expect(client.workflowTransition({ commandId, actionId: "understanding-complete", expectedStateVersion: 1 }))
      .resolves.toMatchObject({ transition: { commandId } });
  });

  it("maps stable Control Plane errors without exposing credentials", async () => {
    const client = new AgentExecutionClient({
      endpoint: "http://localhost:3000",
      executionCode: "a-secret-code-that-must-not-appear",
      fetch: async () => Response.json({ error: { code: "capability_expired", message: "Capability expired" } }, { status: 401 }),
    });
    await expect(client.whoami()).rejects.toMatchObject({ code: "capability_expired", message: "Capability expired" });
  });
});
