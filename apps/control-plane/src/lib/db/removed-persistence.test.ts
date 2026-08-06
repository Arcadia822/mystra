import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("removed persistence surfaces", () => {
  it("limits RdbProvider to IntegrationConnection, Project, and Task", () => {
    const source = readFileSync(path.join(process.cwd(), "src/lib/db/rdb-provider.ts"), "utf8");
    for (const removed of [
      "Session", "Runner", "ContextBundle", "Artifact", "SessionEvent", "Summary",
      "createSession", "registerRunner", "appendSessionEvent", "getTaskSessionSummary",
    ]) {
      expect(source).not.toContain(removed);
    }
  });

  it("keeps removed models out of both Prisma schemas", () => {
    for (const provider of ["sqlite", "postgresql"]) {
      const source = readFileSync(path.join(process.cwd(), `prisma/${provider}/schema.prisma`), "utf8");
      expect(source.match(/^model\s+/gmu)).toHaveLength(3);
      expect(source).not.toMatch(/model\s+(?:Session|Runner|ContextBundle|Artifact|SessionEvent|MystraSchema)\b/u);
    }
  });
});
