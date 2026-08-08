import { describe, expect, it } from "vitest";

import { IntegrationFailure } from "./errors";
import { decodeProjectIssueCursor, encodeProjectIssueCursor } from "./project-issue-cursor";

const scope = {
  provider: "github" as const,
  projectId: "00000000-0000-4000-8000-000000000001",
  connectionId: "00000000-0000-4000-8000-000000000002",
  scopeExternalId: "42",
};

describe("Project Issue cursor", () => {
  it("round trips an upstream cursor only in the exact source scope", () => {
    const cursor = encodeProjectIssueCursor(scope, "page-2");
    expect(decodeProjectIssueCursor(cursor, scope)).toBe("page-2");
  });

  it("rejects malformed and cross-Project cursors", () => {
    expect(() => decodeProjectIssueCursor("not-json", scope)).toThrow(IntegrationFailure);
    const cursor = encodeProjectIssueCursor(scope, "page-2");
    expect(() => decodeProjectIssueCursor(cursor, {
      ...scope,
      projectId: "00000000-0000-4000-8000-000000000003",
    })).toThrowError(expect.objectContaining({ code: "ISSUE_CURSOR_INVALID" }));
  });
});
