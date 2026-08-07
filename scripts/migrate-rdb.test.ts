import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const directories: string[] = [];
const script = path.join(process.cwd(), "scripts/migrate-rdb.mjs");

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("RDB migration wrapper", () => {
  it("deploys and rechecks an empty SQLite database", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "mystra-migration-wrapper-"));
    directories.push(directory);
    const environment = {
      ...process.env,
      MYSTRA_RDB_PROVIDER: "sqlite",
      MYSTRA_DB_PATH: path.join(directory, "mystra.db"),
    };
    const deploy = spawnSync(process.execPath, [script, "deploy"], { env: environment, encoding: "utf8" });
    expect(deploy.status, deploy.stderr).toBe(0);
    const status = spawnSync(process.execPath, [script, "status"], { env: environment, encoding: "utf8" });
    expect(status.status, status.stderr).toBe(0);
    expect(status.stdout).toContain("Database schema is up to date");
  });

  it("fails closed when Supabase has no direct migration URL", () => {
    const runtimeUrl = "postgresql://runtime:do-not-print@pool.example/postgres";
    const result = spawnSync(process.execPath, [script, "deploy"], {
      env: {
        ...process.env,
        MYSTRA_RDB_PROVIDER: "supabase",
        MYSTRA_DATABASE_URL: runtimeUrl,
        MYSTRA_DIRECT_DATABASE_URL: "",
      },
      encoding: "utf8",
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("MYSTRA_DIRECT_DATABASE_URL");
    expect(result.stderr).not.toContain(runtimeUrl);
    expect(result.stderr).not.toContain("do-not-print");
  });

  it("protects destructive reset with an explicit test-only switch", () => {
    const result = spawnSync(process.execPath, [script, "reset"], {
      env: { ...process.env, MYSTRA_RDB_PROVIDER: "sqlite" },
      encoding: "utf8",
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("MYSTRA_ALLOW_TEST_DB_RESET");
  });
});
