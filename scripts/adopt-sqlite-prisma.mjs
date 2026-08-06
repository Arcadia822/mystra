import path from "node:path";

import {
  adoptSqliteDatabase,
  inspectSqliteAdoption,
} from "../apps/control-plane/src/lib/db/sqlite-adoption.ts";

const argumentsList = process.argv.slice(2);
const databaseIndex = argumentsList.indexOf("--database");
const databaseValue = databaseIndex >= 0 ? argumentsList[databaseIndex + 1] : undefined;
if (!databaseValue) {
  process.stderr.write("usage: pnpm db:adopt:sqlite -- --database <path> [--dry-run]\n");
  process.exit(2);
}

const databasePath = path.resolve(process.cwd(), databaseValue);
const dryRun = argumentsList.includes("--dry-run");

try {
  const before = inspectSqliteAdoption(databasePath);
  const result = await adoptSqliteDatabase(databasePath, { dryRun });
  process.stdout.write(`${JSON.stringify({ databasePath, before, result }, null, 2)}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : "SQLite adoption failed";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
