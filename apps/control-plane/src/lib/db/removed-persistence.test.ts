import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const taskMigration = "20260808200000_task_context/migration.sql";

describe("removed persistence surfaces", () => {
  it("reintroduces only the 049 Session persistence boundary", () => {
    const source = readFileSync(path.join(process.cwd(), "src/lib/db/rdb-provider.ts"), "utf8");
    for (const removed of [
      "Runner", "ContextBundle", "Artifact", "Summary", "Turn", "maxConcurrency",
      "registerRunner", "getTaskSessionSummary",
    ]) {
      expect(source).not.toContain(removed);
    }
  });

  it("persists the canonical Session ledger without obsolete execution models", () => {
    for (const provider of ["sqlite", "postgresql"]) {
      const source = readFileSync(path.join(process.cwd(), `prisma/${provider}/schema.prisma`), "utf8");
      expect(source.match(/^model\s+/gmu)).toHaveLength(24);
      expect(source).toMatch(/model\s+Skill\b/u);
      expect(source).toMatch(/model\s+SkillRevision\b/u);
      expect(source).toMatch(/model\s+ProjectIssueSource\b/u);
      expect(source).toMatch(/model\s+Agent\b/u);
      expect(source).toMatch(/model\s+SecretEnvelope\b/u);
      expect(source).toMatch(/model\s+AuthSession\b/u);
      expect(source).toMatch(/model\s+Runtime\b/u);
      expect(source).toMatch(/model\s+RuntimeProvider\b/u);
      expect(source).toMatch(/model\s+TaskWorkspace\b/u);
      expect(source).toMatch(/model\s+TaskExecutionContext\b/u);
      expect(source).not.toMatch(/model\s+Harness\b/u);
      expect(source).toMatch(/model\s+TaskStatusTransition\b/u);
      expect(source).toMatch(/model\s+WorkspacePreparationAttempt\b/u);
      expect(source).toMatch(/model\s+Session\b/u);
      expect(source).toMatch(/model\s+SessionEvent\b/u);
      expect(source).toMatch(/model\s+SessionDispatchLease\b/u);
      expect(source).not.toMatch(/model\s+(?:Runner|ContextBundle|Artifact|Turn|MystraSchema)\b/u);
    }
  });

  it("replaces the pre-0.1 Task table without inventing legacy content", () => {
    for (const provider of ["sqlite", "postgresql"]) {
      const source = readFileSync(path.join(process.cwd(), `prisma/${provider}/migrations/${taskMigration}`), "utf8");
      expect(source).toMatch(/DROP TABLE/u);
      expect(source).toMatch(/CREATE TABLE "tasks"/u);
      expect(source).toMatch(/"project_id" TEXT(?: NOT NULL)?/u);
      expect(source).toMatch(/"title" TEXT NOT NULL/u);
      expect(source).toMatch(/"description" TEXT/u);
      expect(source).toMatch(/"idempotency_key" TEXT/u);
      expect(source).toMatch(/"issue_external_id" TEXT/u);
      expect(source).toMatch(/CHECK/u);
      expect(source).not.toMatch(/INSERT INTO "tasks"|issue_dispatch_key|"metadata"/u);
    }
  });
});
