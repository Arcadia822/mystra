import { describe, expect, it } from "vitest";

import { IntegrationRegistry } from "./registry";
import type {
  IntegrationPlugin,
  IssueProvider,
  RepoProvider,
} from "./types";

const issueProvider: IssueProvider = {
  providerName: "fake",
  repositoryScope: "unsupported",
  async listIssues() {
    return { items: [], pageInfo: { hasNextPage: false } };
  },
  async getIssue() {
    return undefined;
  },
  async resolveWorkspaceBranch() {
    return {
      branchName: "mystra/fake-issue-12345678",
      strategy: "fake-v1",
      source: "issue-provider",
    };
  },
};

const repoProvider: RepoProvider = {
  providerName: "fake",
  async listRepositories() {
    return { items: [], pageInfo: { hasNextPage: false } };
  },
  async getRepository() {
    return undefined;
  },
};

describe("IntegrationRegistry", () => {
  it("lists descriptors and resolves third-party capabilities without provider branches", () => {
    const integration: IntegrationPlugin = {
      descriptor: {
        name: "fake",
        provider: "fake",
        capabilities: ["repositories", "issues"],
      },
      capabilities: { repositories: repoProvider, issues: issueProvider },
    };
    const registry = new IntegrationRegistry([integration]);

    expect(registry.list()).toEqual([integration.descriptor]);
    expect(registry.requireRepoProvider("fake")).toBe(repoProvider);
    expect(registry.requireIssueProvider("fake")).toBe(issueProvider);
  });

  it("distinguishes a missing Integration from missing capabilities", () => {
    const registry = new IntegrationRegistry([
      {
        descriptor: {
          name: "issues-only",
          provider: "fake",
          capabilities: ["issues"],
        },
        capabilities: { issues: issueProvider },
      },
      {
        descriptor: {
          name: "repositories-only",
          provider: "fake",
          capabilities: ["repositories"],
        },
        capabilities: { repositories: repoProvider },
      },
    ]);

    expect(() => registry.requireIssueProvider("missing")).toThrow(
      expect.objectContaining({ code: "INTEGRATION_NOT_FOUND" }),
    );
    expect(() => registry.requireIssueProvider("repositories-only")).toThrow(
      expect.objectContaining({ code: "ISSUE_CAPABILITY_UNAVAILABLE" }),
    );
    expect(() => registry.requireRepoProvider("issues-only")).toThrow(
      expect.objectContaining({ code: "REPOSITORY_CAPABILITY_UNAVAILABLE" }),
    );
  });

  it("rejects duplicate names and descriptor/capability mismatches", () => {
    const valid: IntegrationPlugin = {
      descriptor: {
        name: "fake",
        provider: "fake",
        capabilities: ["issues"],
      },
      capabilities: { issues: issueProvider },
    };

    expect(() => new IntegrationRegistry([valid, valid])).toThrow(
      /Duplicate Integration name: fake/,
    );
    expect(() => new IntegrationRegistry([{
      descriptor: {
        name: "mismatch",
        provider: "fake",
        capabilities: ["repositories"],
      },
      capabilities: { issues: issueProvider },
    }])).toThrow(/capabilities do not match/);
  });
});
