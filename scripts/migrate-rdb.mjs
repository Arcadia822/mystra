import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const actions = new Map([
  ["dev", ["migrate", "dev"]],
  ["deploy", ["migrate", "deploy"]],
  ["reset", ["migrate", "reset", "--force"]],
  ["status", ["migrate", "status"]],
]);

const action = process.argv[2];
const prismaArguments = actions.get(action);
if (!prismaArguments) {
  fail("usage: migrate-rdb.mjs <dev|deploy|reset|status>");
}
if (action === "reset" && process.env.MYSTRA_ALLOW_TEST_DB_RESET !== "1") {
  fail("MYSTRA_ALLOW_TEST_DB_RESET=1 is required for destructive test reset");
}

const provider = process.env.MYSTRA_RDB_PROVIDER ?? "sqlite";
let config;
const environment = { ...process.env, RUST_LOG: "info" };

if (provider === "sqlite") {
  const databasePath = path.resolve(process.cwd(), process.env.MYSTRA_DB_PATH ?? "data/mystra.db");
  mkdirSync(path.dirname(databasePath), { recursive: true });
  environment.MYSTRA_PRISMA_SQLITE_URL = `file:${databasePath}`;
  config = "prisma/sqlite/prisma.config.ts";
} else if (provider === "postgresql" || provider === "supabase") {
  const directUrl = process.env.MYSTRA_DIRECT_DATABASE_URL
    ?? (provider === "postgresql" ? process.env.MYSTRA_DATABASE_URL : undefined);
  if (!directUrl) {
    fail(`${provider === "supabase" ? "MYSTRA_DIRECT_DATABASE_URL" : "MYSTRA_DIRECT_DATABASE_URL or MYSTRA_DATABASE_URL"} is required`);
  }
  assertPostgresqlUrl(directUrl, "MYSTRA_DIRECT_DATABASE_URL");
  environment.MYSTRA_DIRECT_DATABASE_URL = directUrl;
  config = "prisma/postgresql/prisma.config.ts";
} else {
  fail("MYSTRA_RDB_PROVIDER must be sqlite, postgresql, or supabase");
}

const result = spawnSync(
  process.execPath,
  [
    fileURLToPath(new URL("../apps/control-plane/node_modules/prisma/build/index.js", import.meta.url)),
    ...prismaArguments,
    "--config",
    config,
    ...process.argv.slice(3),
  ],
  {
    cwd: path.join(process.cwd(), "apps", "control-plane"),
    env: environment,
    stdio: "inherit",
  },
);

if (result.error) {
  fail("Prisma migration command could not be started");
}
process.exitCode = result.status ?? 1;

function assertPostgresqlUrl(value, variableName) {
  try {
    const url = new URL(value);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
      throw new Error("unsupported protocol");
    }
  } catch {
    fail(`${variableName} must use a valid postgres: or postgresql: URL`);
  }
}

function fail(message) {
  process.stderr.write(`INVALID_RDB_CONFIGURATION: ${message}\n`);
  process.exit(2);
}
