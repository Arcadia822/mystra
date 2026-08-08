import { describe, expect, it } from "vitest";

import {
  githubIssueListResponseSchema,
  linearIssueListResponseSchema,
  projectIssueListResponseSchema,
  projectIssueSourceSchema,
  projectIssueSourceUpsertSchema,
} from "./project-issues.js";

const pageInfo = { hasNextPage: false, endCursor: null } as const;

describe("provider-specific Project Issue contracts", () => {
  it("preserves GitHub-native list fields", () => {
    const response = githubIssueListResponseSchema.parse({
      provider: "github",
      items: [{
        externalId: "I_kwDOExample",
        number: 42,
        title: "Keep provider fields",
        state: "open",
        assignees: [{ id: "1", login: "octocat", avatarUrl: "https://avatars.githubusercontent.com/u/1" }],
        labels: [{ id: "2", name: "bug", color: "d73a4a" }],
        milestone: { id: "3", title: "v1" },
        updatedAt: "2026-08-08T00:00:00.000Z",
        url: "https://github.com/mystra-ai/mystra/issues/42",
      }],
      pageInfo,
    });

    expect(response.items[0]?.assignees).toHaveLength(1);
    expect(response.items[0]?.milestone?.title).toBe("v1");
  });

  it("preserves Linear-native list fields", () => {
    const response = linearIssueListResponseSchema.parse({
      provider: "linear",
      items: [{
        externalId: "issue-id",
        identifier: "ENG-42",
        title: "Keep Linear semantics",
        status: { id: "state-id", name: "In Progress", type: "started" },
        priority: { value: 2, label: "High" },
        assignee: { id: "user-id", name: "Ada" },
        cycle: { id: "cycle-id", name: "Cycle 12", number: 12 },
        updatedAt: "2026-08-08T00:00:00.000Z",
        url: "https://linear.app/example/issue/ENG-42",
      }],
      pageInfo,
    });

    expect(response.items[0]?.priority?.label).toBe("High");
    expect(response.items[0]?.cycle?.number).toBe(12);
  });

  it("uses a discriminated union and rejects fused or unsafe rows", () => {
    expect(projectIssueListResponseSchema.parse({ provider: "github", items: [], pageInfo }).provider).toBe("github");
    expect(() => projectIssueListResponseSchema.parse({ provider: "all", items: [], pageInfo })).toThrow();
    expect(() => githubIssueListResponseSchema.parse({
      provider: "github",
      items: [{
        externalId: "1",
        number: 1,
        title: "Unsafe",
        state: "open",
        assignees: [],
        labels: [],
        milestone: null,
        updatedAt: "2026-08-08T00:00:00.000Z",
        url: "javascript:alert(1)",
      }],
      pageInfo,
    })).toThrow();
  });

  it("models only an exact Linear Team source while GitHub remains derived", () => {
    const input = projectIssueSourceUpsertSchema.parse({
      connectionId: "00000000-0000-4000-8000-000000000041",
      linearTeamExternalId: "team-id",
    });
    expect(input.linearTeamExternalId).toBe("team-id");
    expect(projectIssueSourceSchema.parse({
      id: "00000000-0000-4000-8000-000000000045",
      teamId: "00000000-0000-4000-8000-000000000038",
      projectId: "00000000-0000-4000-8000-000000000039",
      integration: "linear",
      connectionId: input.connectionId,
      scopeType: "linear-team",
      scopeExternalId: input.linearTeamExternalId,
      createdAt: "2026-08-08T00:00:00.000Z",
      updatedAt: "2026-08-08T00:00:00.000Z",
    }).integration).toBe("linear");
  });
});
