import { describe, expect, it } from "vitest";

import { linearConnectionSummary, linearConnections } from "./linear-integration-model";

const connection = {
  id: "00000000-0000-4000-8000-000000000001",
  teamId: "00000000-0000-4000-8000-000000000002",
  integration: "linear",
  provider: "linear",
  authMethod: "api-key",
  providerExternalId: "org-id",
  displayName: "Product",
  providerSubject: { organizationName: "Mystra" },
  connectionConfig: {}, capabilities: {}, credentialState: "ready", status: "active",
  createdAt: "2026-08-08T00:00:00.000Z", updatedAt: "2026-08-08T00:00:00.000Z",
} as const;

describe("Linear Integration detail model", () => {
  it("selects only API-key Linear connections", () => {
    expect(linearConnections({ providers: [], connections: [connection] })[0]?.id).toBe(connection.id);
  });

  it("presents non-secret health metadata", () => {
    expect(linearConnectionSummary(connection)).toBe("Mystra · API key · active/ready");
  });
});
