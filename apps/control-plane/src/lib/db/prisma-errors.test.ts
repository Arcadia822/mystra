import { describe, expect, it } from "vitest";

import { normalizeDatabaseError, RdbError } from "./prisma-errors";

describe("Prisma database error boundary", () => {
  it("maps known constraint codes without exposing the original cause", () => {
    const cause = Object.assign(
      new Error("postgresql://admin:password@db.example.com/mystra?token=secret query=INSERT"),
      { code: "P2002", meta: { target: ["slug"] } },
    );
    const error = normalizeDatabaseError(cause, {
      conflictCode: "PROJECT_SLUG_CONFLICT",
      conflictMessage: "Project slug already exists",
    });

    expect(error).toBeInstanceOf(RdbError);
    expect(error.code).toBe("PROJECT_SLUG_CONFLICT");
    expect(error.message).toBe("PROJECT_SLUG_CONFLICT: Project slug already exists");
    expect(JSON.stringify(error)).not.toMatch(/password|db\.example|token|INSERT/iu);
  });

  it("normalizes foreign-key and unavailable failures to stable messages", () => {
    const foreignKey = normalizeDatabaseError({ code: "P2003" }, {
      relationCode: "INTEGRATION_CONNECTION_IN_USE",
      relationMessage: "Integration connection is still bound to a Project",
    });
    expect(foreignKey.message).toBe(
      "INTEGRATION_CONNECTION_IN_USE: Integration connection is still bound to a Project",
    );

    const unavailable = normalizeDatabaseError(
      new Error("connect ECONNREFUSED postgresql://user:secret@private-host/database"),
    );
    expect(unavailable.message).toBe("RDB_UNAVAILABLE: Database operation failed");
    expect(unavailable.message).not.toMatch(/secret|private-host/iu);
  });
});
