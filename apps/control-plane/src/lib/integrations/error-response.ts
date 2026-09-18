import { NextResponse } from "next/server";
import { integrationErrorCodeSchema, integrationErrorResponseSchema } from "@mystra/shared";
import { ZodError } from "zod";

import { RdbError } from "../db/prisma-errors";
import { IntegrationFailure, integrationErrorStatusByCode } from "./failure";

export { IntegrationFailure, integrationErrorStatusByCode } from "./failure";

/**
 * Relational conflicts that are part of the public Integration contract. The
 * RDB vocabulary and the public error vocabulary intentionally share these
 * names, so a repository-layer conflict can be reported with its documented
 * status instead of the generic 400 dispatch fallback.
 */
function publicCodeFromRdbError(error: RdbError): string | undefined {
  return integrationErrorCodeSchema.safeParse(error.code).success ? error.code : undefined;
}

export function integrationErrorResponse(error: unknown): NextResponse {
  if (error instanceof IntegrationFailure) {
    return NextResponse.json(
      integrationErrorResponseSchema.parse({
        error: {
          code: error.code,
          message: error.message,
          ...(error.retryAfterSeconds !== undefined
            ? { retryAfterSeconds: error.retryAfterSeconds }
            : {}),
          ...(error.details ? { details: error.details } : {}),
        },
      }),
      { status: error.status },
    );
  }

  if (error instanceof RdbError) {
    const code = publicCodeFromRdbError(error);
    if (code) {
      const separator = error.message.indexOf(": ");
      return NextResponse.json(
        integrationErrorResponseSchema.parse({
          error: { code, message: separator >= 0 ? error.message.slice(separator + 2) : error.message },
        }),
        { status: integrationErrorStatusByCode[code as keyof typeof integrationErrorStatusByCode] },
      );
    }
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "Request validation failed",
          details: { issues: error.issues },
        },
      },
      { status: 400 },
    );
  }

  const message = error instanceof Error ? error.message : "Unknown dispatch failure";
  const code = message.startsWith("PROJECT_NOT_FOUND")
    ? "PROJECT_NOT_FOUND"
    : message.startsWith("PROJECT_ARCHIVED")
      ? "PROJECT_ARCHIVED"
      : message.startsWith("INVALID_GITHUB_REPOSITORY")
        ? "INVALID_GITHUB_REPOSITORY"
        : "INVALID_DISPATCH";
  const status = code === "PROJECT_NOT_FOUND" ? 404 : 400;
  return NextResponse.json({ error: { code, message } }, { status });
}
