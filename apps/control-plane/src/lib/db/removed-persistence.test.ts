import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("removed persistence surfaces", () => {
  it("excludes deferred execution persistence while allowing local auth and Team RBAC", () => {
    const source = readFileSync(path.join(process.cwd(), "src/lib/db/rdb-provider.ts"), "utf8");
    for (const removed of [
      "Runner", "ContextBundle", "Artifact", "SessionEvent", "Summary",
      "createSession", "registerRunner", "appendSessionEvent", "getTaskSessionSummary",
    ]) {
      expect(source).not.toContain(removed);
    }
  });

  it("keeps deferred execution models out of both Prisma schemas", () => {
    for (const provider of ["sqlite", "postgresql"]) {
      const source = readFileSync(path.join(process.cwd(), `prisma/${provider}/schema.prisma`), "utf8");
      expect(source.match(/^model\s+/gmu)).toHaveLength(9);
      expect(source).toMatch(/model\s+SecretEnvelope\b/u);
      expect(source).toMatch(/model\s+AuthSession\b/u);
      expect(source).not.toMatch(/model\s+(?:Runner|ContextBundle|Artifact|SessionEvent|MystraSchema)\b/u);
    }
  });
});
