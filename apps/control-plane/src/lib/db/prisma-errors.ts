export type RdbErrorCode =
  | "AGENT_ARCHIVED"
  | "AGENT_REVISION_CONFLICT"
  | "AGENT_UNAVAILABLE"
  | "DISPATCH_CONFLICT"
  | "INTEGRATION_CONNECTION_CONFLICT"
  | "INTEGRATION_CONNECTION_IN_USE"
  | "PROJECT_SLUG_CONFLICT"
  | "RDB_CONFLICT"
  | "RDB_NOT_FOUND"
  | "RDB_RELATION_CONFLICT"
  | "RDB_UNAVAILABLE"
  | "STALE_WORKSPACE_ATTEMPT"
  | "TASK_WORKSPACE_CONFLICT";

export class RdbError extends Error {
  readonly code: RdbErrorCode;

  constructor(code: RdbErrorCode, safeMessage: string) {
    super(`${code}: ${safeMessage}`);
    this.name = "RdbError";
    this.code = code;
  }
}

type NormalizeDatabaseErrorOptions = {
  conflictCode?: RdbErrorCode;
  conflictMessage?: string;
  relationCode?: RdbErrorCode;
  relationMessage?: string;
  notFoundCode?: RdbErrorCode;
  notFoundMessage?: string;
};

function databaseErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }
  return typeof error.code === "string" ? error.code : undefined;
}

export function isDatabaseErrorCode(error: unknown, code: string): boolean {
  return databaseErrorCode(error) === code;
}

/**
 * Converts driver and Prisma failures into safe domain errors.
 *
 * The original error is deliberately not attached as `cause`: several HTTP and
 * MCP boundaries serialize enumerable error properties, and driver causes may
 * contain full URLs, usernames, passwords, query text, or hostnames.
 */
export function normalizeDatabaseError(
  error: unknown,
  options: NormalizeDatabaseErrorOptions = {},
): RdbError {
  if (error instanceof RdbError) {
    return error;
  }

  switch (databaseErrorCode(error)) {
    case "P2002":
    case "P2034":
      return new RdbError(
        options.conflictCode ?? "RDB_CONFLICT",
        options.conflictMessage ?? "A unique value is already in use",
      );
    case "P2003":
    case "P2014":
      return new RdbError(
        options.relationCode ?? "RDB_RELATION_CONFLICT",
        options.relationMessage ?? "The record is still referenced",
      );
    case "P2025":
      return new RdbError(
        options.notFoundCode ?? "RDB_NOT_FOUND",
        options.notFoundMessage ?? "The requested record does not exist",
      );
    default:
      return new RdbError("RDB_UNAVAILABLE", "Database operation failed");
  }
}
