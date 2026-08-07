import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const installation = readFileSync(path.join(root, "INSTALLATION.md"), "utf8");
const rootPackage = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

describe("Installation documentation", () => {
  it("references implemented commands and provider configuration", () => {
    for (const command of [
      "db:validate", "db:generate", "db:migrate:deploy", "db:migrate:status",
      "db:migrate:dev", "db:adopt:sqlite", "db:test:postgresql",
    ]) {
      expect(rootPackage.scripts).toHaveProperty(command);
      expect(installation).toContain(`pnpm ${command}`);
    }
    for (const variable of [
      "MYSTRA_RDB_PROVIDER", "MYSTRA_DB_PATH", "MYSTRA_DATABASE_URL",
      "MYSTRA_DIRECT_DATABASE_URL", "MYSTRA_DB_POOL_MAX",
    ]) {
      expect(installation).toContain(variable);
    }
  });

  it("keeps root, module, and installation documentation linked", () => {
    const readme = readFileSync(path.join(root, "README.md"), "utf8");
    const moduleReadme = readFileSync(path.join(root, "apps/control-plane/src/lib/db/README.md"), "utf8");
    expect(readme).toContain("[INSTALLATION.md](INSTALLATION.md)");
    expect(moduleReadme).toContain("[Installation guide](../../../../../INSTALLATION.md)");
    expect(existsSync(path.join(root, "scripts/migrate-rdb.mjs"))).toBe(true);
    expect(existsSync(path.join(root, "scripts/adopt-sqlite-prisma.mjs"))).toBe(true);
  });
});
