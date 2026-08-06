import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { getDb, resetDbForTests } from "./index";

const originalEnvironment = { ...process.env };
const tempDirectories: string[] = [];

afterEach(async () => {
  await resetDbForTests();
  process.env = { ...originalEnvironment };
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("RDB provider lifecycle", () => {
  it("shares one initialization promise for concurrent first access", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "mystra-db-singleton-"));
    tempDirectories.push(directory);
    process.env.MYSTRA_RDB_PROVIDER = "sqlite";
    process.env.MYSTRA_DB_PATH = path.join(directory, "mystra.db");

    const [first, second, third] = await Promise.all([getDb(), getDb(), getDb()]);
    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  it("clears a rejected initialization so corrected configuration can retry", async () => {
    process.env.MYSTRA_RDB_PROVIDER = "postgresql";
    delete process.env.MYSTRA_DATABASE_URL;
    await expect(getDb()).rejects.toThrow("MYSTRA_DATABASE_URL");

    const directory = mkdtempSync(path.join(tmpdir(), "mystra-db-retry-"));
    tempDirectories.push(directory);
    process.env.MYSTRA_RDB_PROVIDER = "sqlite";
    process.env.MYSTRA_DB_PATH = path.join(directory, "mystra.db");
    await expect(getDb()).resolves.toBeDefined();
  });
});
