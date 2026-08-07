import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const dbDirectory = path.join(process.cwd(), "src/lib/db");

describe("Prisma persistence boundary", () => {
  it("removes the legacy SQLite runtime owner", () => {
    expect(existsSync(path.join(dbDirectory, "sqlite-provider.ts"))).toBe(false);
    expect(existsSync(path.join(dbDirectory, "migrations.ts"))).toBe(false);
  });

  it("keeps driver and generated Prisma imports inside the DB module", () => {
    const projectRoot = path.resolve(process.cwd());
    const candidates = [
      "src/lib/integrations/github-pat-service.ts",
      "src/lib/integrations/github-credential.ts",
      "../../packages/shared/src/integrations.ts",
      "../../packages/shared/src/schemas.ts",
    ];
    for (const candidate of candidates) {
      const source = readFileSync(path.join(projectRoot, candidate), "utf8");
      expect(source).not.toMatch(/@prisma\/|generated\/prisma|adapter-pg|better-sqlite3/u);
    }
  });

  it("contains no runtime raw SQL escape hatch in the Prisma provider", () => {
    const source = readFileSync(path.join(dbDirectory, "prisma-provider.ts"), "utf8");
    expect(source).not.toMatch(/\$(?:queryRaw|executeRaw)|\.query\s*\(|\.exec\s*\(/u);
  });
});
