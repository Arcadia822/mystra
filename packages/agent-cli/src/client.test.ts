import { describe, expect, it } from "vitest";

import { AgentExecutionClient } from "./client.js";

describe("AgentExecutionClient", () => {
  it("maps stable Control Plane errors without exposing credentials", async () => {
    const client = new AgentExecutionClient({
      endpoint: "http://localhost:3000",
      executionCode: "a-secret-code-that-must-not-appear",
      fetch: async () => Response.json({ error: { code: "capability_expired", message: "Capability expired" } }, { status: 401 }),
    });
    await expect(client.whoami()).rejects.toMatchObject({ code: "capability_expired", message: "Capability expired" });
  });
});
