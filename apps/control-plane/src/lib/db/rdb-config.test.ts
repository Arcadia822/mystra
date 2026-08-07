import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseRdbConfiguration } from "./rdb-config";

describe("parseRdbConfiguration", () => {
  it("defaults to SQLite and resolves an explicit path", () => {
    expect(parseRdbConfiguration({}, "/srv/mystra")).toEqual({
      provider: "sqlite",
      databasePath: path.join("/srv/mystra", "data", "mystra.db"),
    });
    expect(parseRdbConfiguration({ MYSTRA_DB_PATH: "./state/local.db" }, "/srv/mystra")).toEqual({
      provider: "sqlite",
      databasePath: path.join("/srv/mystra", "state", "local.db"),
    });
  });

  it("parses PostgreSQL URLs and bounded pool settings", () => {
    expect(parseRdbConfiguration({
      MYSTRA_RDB_PROVIDER: "postgresql",
      MYSTRA_DATABASE_URL: "postgresql://runtime:secret@db.example/mystra",
      MYSTRA_DB_POOL_MAX: "7",
      MYSTRA_DB_CONNECTION_TIMEOUT_MS: "2500",
      MYSTRA_DB_IDLE_TIMEOUT_MS: "0",
    })).toEqual({
      provider: "postgresql",
      runtimeUrl: "postgresql://runtime:secret@db.example/mystra",
      directUrl: "postgresql://runtime:secret@db.example/mystra",
      pool: { max: 7, connectionTimeoutMillis: 2500, idleTimeoutMillis: 0 },
    });
  });

  it("requires distinct explicit runtime and direct URLs for Supabase", () => {
    const config = parseRdbConfiguration({
      MYSTRA_RDB_PROVIDER: "supabase",
      MYSTRA_DATABASE_URL: "postgresql://pooler:secret@pooler.example/postgres",
      MYSTRA_DIRECT_DATABASE_URL: "postgresql://direct:secret@db.example/postgres",
    });
    expect(config.provider).toBe("supabase");
    expect(config).toMatchObject({
      pool: { max: 10, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000 },
    });
  });

  it.each([
    [{ MYSTRA_RDB_PROVIDER: "mysql" }, "MYSTRA_RDB_PROVIDER"],
    [{ MYSTRA_RDB_PROVIDER: "postgresql" }, "MYSTRA_DATABASE_URL"],
    [{ MYSTRA_RDB_PROVIDER: "postgresql", MYSTRA_DATABASE_URL: "mysql://secret@db/x" }, "MYSTRA_DATABASE_URL"],
    [{ MYSTRA_RDB_PROVIDER: "supabase", MYSTRA_DATABASE_URL: "postgresql://secret@pool/x" }, "MYSTRA_DIRECT_DATABASE_URL"],
    [{ MYSTRA_RDB_PROVIDER: "postgresql", MYSTRA_DATABASE_URL: "postgresql://secret@db/x", MYSTRA_DB_POOL_MAX: "0" }, "MYSTRA_DB_POOL_MAX"],
  ])("fails safely for invalid configuration", (environment, variableName) => {
    expect(() => parseRdbConfiguration(environment)).toThrow(variableName);
    try {
      parseRdbConfiguration(environment);
    } catch (error) {
      expect(String(error)).not.toContain("secret@");
      expect(String(error)).not.toContain("mysql://");
    }
  });
});
