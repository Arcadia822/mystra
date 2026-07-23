import { describe, expect, it } from "vitest";

import { IntegrationRegistry } from "./registry";
import type { Integration, IssueProvider } from "./types";

const issueProvider: IssueProvider = {
  providerName: "fake",
  async listIssues() {
    return { items: [], pageInfo: { hasNextPage: false } };
  },
  async getIssue() {
    return undefined;
  },
};

describe("IntegrationRegistry", () => {
  it("returns the requested Issue capability", () => {
    const integration: Integration = {
      name: "fake",
      provider: "fake",
      capabilities: { issues: issueProvider },
    };
    const registry = new IntegrationRegistry([integration]);

    expect(registry.requireIssueProvider("fake")).toBe(issueProvider);
  });

  it("distinguishes a missing Integration from a missing Issue capability", () => {
    const registry = new IntegrationRegistry([{
      name: "without-issues",
      provider: "fake",
      capabilities: {},
    }]);

    expect(() => registry.requireIssueProvider("missing")).toThrow(
      expect.objectContaining({ code: "INTEGRATION_NOT_FOUND" }),
    );
    expect(() => registry.requireIssueProvider("without-issues")).toThrow(
      expect.objectContaining({ code: "ISSUE_CAPABILITY_UNAVAILABLE" }),
    );
  });
});
