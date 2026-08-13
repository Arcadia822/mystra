import { describe, expect, it } from "vitest";

import { lineViolations } from "./audit-task-session-terminology.mjs";

describe("Task/Session and Standard Agent Context terminology audit", () => {
  it("rejects default or sentinel Agent concepts and the removed Assign path", () => {
    for (const content of [
      "Use the Default Agent",
      "const sentinelAgentId = value;",
      "fetch('/api/tasks/id/production/assign')",
      "taskAssignRequestSchema.parse(value)",
      "Assign & start",
    ]) {
      expect(lineViolations("fixture.ts", content)).toHaveLength(1);
    }
  });

  it("accepts Standard Execution Prompt and Optional Agent Context vocabulary", () => {
    expect(lineViolations(
      "fixture.ts",
      "Start production with the Standard Execution Prompt and Optional Agent Context.",
    )).toEqual([]);
  });

  it("keeps the explicit negative-compatibility allow marker", () => {
    expect(lineViolations(
      "fixture.test.ts",
      "// legacy-term-audit: allow\nexpect('/production/assign').not.toExist();",
    )).toEqual([]);
  });
});
