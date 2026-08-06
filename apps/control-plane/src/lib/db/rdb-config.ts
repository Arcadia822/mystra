import path from "node:path";

export type SqliteRdbConfiguration = {
  provider: "sqlite";
  databasePath: string;
};

export type PostgresqlRdbConfiguration = {
  provider: "postgresql" | "supabase";
  runtimeUrl: string;
  directUrl: string;
  pool: {
    max: number;
    connectionTimeoutMillis: number;
    idleTimeoutMillis: number;
  };
};

export type RdbConfiguration = SqliteRdbConfiguration | PostgresqlRdbConfiguration;

export class RdbConfigurationError extends Error {
  constructor(variableName: string, reason: string) {
    super(`INVALID_RDB_CONFIGURATION: ${variableName} ${reason}`);
    this.name = "RdbConfigurationError";
  }
}

type Environment = Record<string, string | undefined>;

export function parseRdbConfiguration(
  environment: Environment = process.env,
  cwd = process.cwd(),
): RdbConfiguration {
  const provider = environment.MYSTRA_RDB_PROVIDER ?? "sqlite";
  if (provider === "sqlite") {
    const configuredPath = environment.MYSTRA_DB_PATH ?? path.join("data", "mystra.db");
    return {
      provider,
      databasePath: configuredPath === ":memory:" ? configuredPath : path.resolve(cwd, configuredPath),
    };
  }
  if (provider !== "postgresql" && provider !== "supabase") {
    throw new RdbConfigurationError(
      "MYSTRA_RDB_PROVIDER",
      "must be one of sqlite, postgresql, or supabase",
    );
  }

  const runtimeUrl = requirePostgresqlUrl(environment, "MYSTRA_DATABASE_URL");
  const directUrl = provider === "supabase"
    ? requirePostgresqlUrl(environment, "MYSTRA_DIRECT_DATABASE_URL")
    : environment.MYSTRA_DIRECT_DATABASE_URL
      ? validatePostgresqlUrl(environment.MYSTRA_DIRECT_DATABASE_URL, "MYSTRA_DIRECT_DATABASE_URL")
      : runtimeUrl;

  return {
    provider,
    runtimeUrl,
    directUrl,
    pool: {
      max: parseInteger(environment, "MYSTRA_DB_POOL_MAX", 10, { min: 1, max: 100 }),
      connectionTimeoutMillis: parseInteger(
        environment,
        "MYSTRA_DB_CONNECTION_TIMEOUT_MS",
        5000,
        { min: 1, max: 120_000 },
      ),
      idleTimeoutMillis: parseInteger(
        environment,
        "MYSTRA_DB_IDLE_TIMEOUT_MS",
        10_000,
        { min: 0, max: 600_000 },
      ),
    },
  };
}

function requirePostgresqlUrl(environment: Environment, name: string): string {
  const value = environment[name];
  if (!value) {
    throw new RdbConfigurationError(name, "is required");
  }
  return validatePostgresqlUrl(value, name);
}

function validatePostgresqlUrl(value: string, name: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
      throw new Error("unsupported protocol");
    }
  } catch {
    throw new RdbConfigurationError(name, "must use a valid postgres: or postgresql: URL");
  }
  return value;
}

function parseInteger(
  environment: Environment,
  name: string,
  defaultValue: number,
  bounds: { min: number; max: number },
): number {
  const raw = environment[name];
  if (raw === undefined) {
    return defaultValue;
  }
  if (!/^(?:0|[1-9][0-9]*)$/u.test(raw)) {
    throw new RdbConfigurationError(name, `must be an integer from ${bounds.min} to ${bounds.max}`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < bounds.min || value > bounds.max) {
    throw new RdbConfigurationError(name, `must be an integer from ${bounds.min} to ${bounds.max}`);
  }
  return value;
}
