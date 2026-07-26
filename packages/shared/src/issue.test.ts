import { describe, expect, it } from "vitest";

import {
  integrationDescriptorSchema,
  integrationErrorResponseSchema,
  issueDispatchRequestSchema,
  issueGetRequestSchema,
  issueListRequestSchema,
  issueListResponseSchema,
  issueSchema,
  issueSnapshotSchema,
} from "./issue.js";

const issue = {
  reference: {
    integration: "linear",
    provider: "linear",
    externalId: "f4f3a643-4d72-4d4d-bdc5-499ce34f62f2",
    identifier: "ENG-123",
    url: "https://linear.app/example/issue/ENG-123/example",
  },
  title: "Add a visible health indicator",
  description: "Expose one deterministic health state.",
  state: {
    id: "state-1",
    name: "Todo",
    type: "unstarted",
  },
  priority: {
    value: 2,
    label: "High",
  },
  assignee: {
    id: "user-1",
    name: "Arcadia",
  },
  labels: [
    {
      id: "label-1",
      name: "demo",
    },
  ],
  createdAt: "2026-07-22T00:00:00.000Z",
  updatedAt: "2026-07-23T00:00:00.000Z",
  fetchedAt: "2026-07-23T01:00:00.000Z",
};

describe("Issue contracts", () => {
  it("normalizes a provider-neutral Issue and immutable snapshot", () => {
    expect(issueSchema.parse(issue)).toEqual(issue);
    expect(issueSnapshotSchema.parse(issue)).toEqual(issue);
  });

  it("rejects provider payload leakage and invalid URLs", () => {
    expect(() => issueSchema.parse({
      ...issue,
      rawGraphqlResponse: { token: "not-allowed" },
    })).toThrow();

    expect(() => issueSchema.parse({
      ...issue,
      reference: {
        ...issue.reference,
        url: "not-a-url",
      },
    })).toThrow();
  });

  it("validates bounded cursor pagination and strict list responses", () => {
    expect(issueListRequestSchema.parse({ first: 25 })).toEqual({ first: 25 });
    expect(() => issueListRequestSchema.parse({ first: 101 })).toThrow();
    expect(issueListResponseSchema.parse({
      items: [issue],
      pageInfo: {
        hasNextPage: true,
        endCursor: "cursor-1",
      },
    }).pageInfo.endCursor).toBe("cursor-1");
    expect(() => issueListResponseSchema.parse({
      items: [issue],
      pageInfo: {
        hasNextPage: false,
        upstreamTotal: 99,
      },
    })).toThrow();
  });

  it("supports provider-neutral repository scope for repository-scoped Issues", () => {
    const repository = {
      integration: "github",
      provider: "github",
      externalId: "R_kgDOFixture",
      fullName: "Arcadia822/mystra-remote-e2e",
      url: "https://github.com/Arcadia822/mystra-remote-e2e",
      cloneUrl: "https://github.com/Arcadia822/mystra-remote-e2e.git",
      defaultBranch: "main",
      visibility: "private",
      isArchived: false,
      fetchedAt: "2026-07-26T00:00:00.000Z",
    };
    expect(issueListRequestSchema.parse({ first: 10, repository })).toEqual({
      first: 10,
      repository,
    });
    expect(issueGetRequestSchema.parse({ identifier: "17", repository })).toEqual({
      identifier: "17",
      repository,
    });
  });

  it("models Integration capabilities without embedding provider credentials", () => {
    expect(integrationDescriptorSchema.parse({
      name: "github",
      provider: "github",
      capabilities: ["repositories", "issues"],
    })).toEqual({
      name: "github",
      provider: "github",
      capabilities: ["repositories", "issues"],
    });

    expect(integrationDescriptorSchema.parse({
      name: "linear",
      provider: "linear",
      capabilities: ["issues"],
    })).toEqual({
      name: "linear",
      provider: "linear",
      capabilities: ["issues"],
    });

    expect(() => integrationDescriptorSchema.parse({
      name: "linear",
      provider: "linear",
      capabilities: ["issues"],
      apiKey: "not-allowed",
    })).toThrow();
  });

  it("requires an explicit Project, Agent and safe branch for dispatch", () => {
    expect(issueDispatchRequestSchema.parse({
      projectId: "550e8400-e29b-41d4-a716-446655440000",
      agent: "copilot",
      branchName: "codex/eng-123",
    })).toEqual({
      projectId: "550e8400-e29b-41d4-a716-446655440000",
      agent: "copilot",
      branchName: "codex/eng-123",
    });

    expect(() => issueDispatchRequestSchema.parse({
      projectId: "550e8400-e29b-41d4-a716-446655440000",
      agent: "copilot",
      branchName: "--upload-pack=malicious",
    })).toThrow();

    expect(() => issueDispatchRequestSchema.parse({
      projectId: "550e8400-e29b-41d4-a716-446655440000",
      agent: "codex",
      branchName: "codex/eng-123",
    })).toThrow();
  });

  it("exports stable integration errors without raw upstream details", () => {
    const parsed = integrationErrorResponseSchema.parse({
      error: {
        code: "INTEGRATION_RATE_LIMITED",
        message: "Linear rate limit exceeded",
        retryAfterSeconds: 30,
      },
    });

    expect(parsed.error.code).toBe("INTEGRATION_RATE_LIMITED");
    expect(() => integrationErrorResponseSchema.parse({
      error: {
        code: "SOMETHING_LINEAR_SAID",
        message: "raw",
      },
    })).toThrow();
  });
});
