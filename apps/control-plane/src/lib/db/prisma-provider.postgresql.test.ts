import { execFileSync } from "node:child_process";

import { beforeAll, describe } from "vitest";

import { createPostgresqlPrismaClient } from "./prisma-client";
import { PrismaRdbProvider } from "./prisma-provider";
import { runRdbProviderContract } from "./rdb-provider.contract";

const databaseUrl = process.env.MYSTRA_TEST_POSTGRES_URL;

describe.skipIf(!databaseUrl)("PrismaRdbProvider PostgreSQL contract", () => {
  beforeAll(() => {
    execFileSync("pnpm", [
      "exec",
      "prisma",
      "migrate",
      "deploy",
      "--config",
      "prisma/postgresql/prisma.config.ts",
    ], {
      cwd: process.cwd(),
      env: { ...process.env, MYSTRA_DIRECT_DATABASE_URL: databaseUrl },
      stdio: "inherit",
    });
  });

  runRdbProviderContract(async () => new PrismaRdbProvider(createPostgresqlPrismaClient({
    databaseUrl: databaseUrl!,
    maxConnections: 4,
    connectionTimeoutMs: 5000,
    idleTimeoutMs: 1000,
  })));
});
