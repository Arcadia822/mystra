import { mkdirSync } from "node:fs";
import path from "node:path";

import {
  createPostgresqlPrismaClient,
  createSqlitePrismaClient,
  type MystraPrismaClient,
} from "./prisma-client";
import { normalizeDatabaseError } from "./prisma-errors";
import { PrismaRdbProvider } from "./prisma-provider";
import { parseRdbConfiguration, type RdbConfiguration } from "./rdb-config";
import type { RdbProvider } from "./rdb-provider";

let providerPromise: Promise<RdbProvider> | undefined;

export function getDb(): Promise<RdbProvider> {
  if (!providerPromise) {
    providerPromise = Promise.resolve()
      .then(() => initializeProvider(parseRdbConfiguration()))
      .catch((error: unknown) => {
        providerPromise = undefined;
        throw error;
      });
  }
  return providerPromise;
}

export async function resetDbForTests(): Promise<void> {
  const pending = providerPromise;
  providerPromise = undefined;
  if (pending) {
    const provider = await pending.catch(() => undefined);
    await provider?.close();
  }
}

export async function shutdownDb(): Promise<void> {
  await resetDbForTests();
}

async function initializeProvider(configuration: RdbConfiguration): Promise<RdbProvider> {
  let client: MystraPrismaClient | undefined;
  try {
    if (configuration.provider === "sqlite") {
      if (configuration.databasePath !== ":memory:") {
        mkdirSync(path.dirname(configuration.databasePath), { recursive: true });
      }
      client = createSqlitePrismaClient({
        databaseUrl: configuration.databasePath === ":memory:"
          ? ":memory:"
          : `file:${configuration.databasePath}`,
      });
    } else {
      client = createPostgresqlPrismaClient({
        databaseUrl: configuration.runtimeUrl,
        maxConnections: configuration.pool.max,
        connectionTimeoutMs: configuration.pool.connectionTimeoutMillis,
        idleTimeoutMs: configuration.pool.idleTimeoutMillis,
      });
    }

    await client.connect();
    return new PrismaRdbProvider(client);
  } catch (error) {
    await client?.disconnect().catch(() => undefined);
    throw normalizeDatabaseError(error);
  }
}
