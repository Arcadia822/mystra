import { mkdirSync } from "node:fs";
import path from "node:path";

import { SqliteRdbProvider } from "./sqlite-provider";
import type { RdbProvider } from "./rdb-provider";

let provider: RdbProvider | undefined;

function defaultDbPath(): string {
  return path.join(process.cwd(), "data", "mystra.db");
}

export function getDb(): RdbProvider {
  if (!provider) {
    const dbPath = process.env.MYSTRA_DB_PATH ?? defaultDbPath();
    mkdirSync(path.dirname(dbPath), { recursive: true });
    provider = new SqliteRdbProvider(dbPath);
  }

  return provider;
}

export function resetDbForTests(): void {
  provider?.close();
  provider = undefined;
}
