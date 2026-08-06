import { NextResponse } from "next/server";
import {
  integrationErrorResponseSchema,
  type IntegrationErrorCode,
} from "@mystra/shared";
import { ZodError } from "zod";

const statusByCode: Record<IntegrationErrorCode, number> = {
  INTEGRATION_NOT_FOUND: 404,
  INTEGRATION_CONNECTION_NOT_FOUND: 404,
  INTEGRATION_CONNECTION_MISMATCH: 400,
  INTEGRATION_CONNECTION_INACTIVE: 409,
  INTEGRATION_CONNECTION_SELECTION_REQUIRED: 409,
  INTEGRATION_CONNECTION_IN_USE: 409,
  INTEGRATION_CONNECTION_METHOD_DISABLED: 503,
  INTEGRATION_CONNECTION_METHOD_UNAVAILABLE: 409,
  INTEGRATION_CONNECTION_DELETE_INCOMPLETE: 409,
  INTEGRATION_CREDENTIAL_INVALID: 401,
  INTEGRATION_CREDENTIAL_UNAVAILABLE: 409,
  GITHUB_APP_NOT_CONFIGURED: 503,
  GITHUB_OAUTH_INVALID: 400,
  GITHUB_INSTALLATION_UNVERIFIED: 403,
  REPOSITORY_CAPABILITY_UNAVAILABLE: 404,
  ISSUE_CAPABILITY_UNAVAILABLE: 404,
  REPOSITORY_NOT_FOUND: 404,
  REPOSITORY_SCOPE_REQUIRED: 400,
  ISSUE_NOT_FOUND: 404,
  INTEGRATION_NOT_CONFIGURED: 503,
  INTEGRATION_UNAUTHORIZED: 502,
  INTEGRATION_RATE_LIMITED: 429,
  INTEGRATION_TIMEOUT: 504,
  INTEGRATION_UPSTREAM_ERROR: 502,
  INTEGRATION_INVALID_RESPONSE: 502,
  DISPATCH_CONFLICT: 409,
};

export class IntegrationFailure extends Error {
  readonly code: IntegrationErrorCode;
  readonly status: number;
  readonly retryAfterSeconds: number | undefined;
  readonly details: Record<string, unknown> | undefined;

  constructor(input: {
    code: IntegrationErrorCode;
    message: string;
    status?: number;
    retryAfterSeconds?: number;
    details?: Record<string, unknown>;
  }) {
    super(input.message);
    this.name = "IntegrationFailure";
    this.code = input.code;
    this.status = input.status ?? statusByCode[input.code];
    this.retryAfterSeconds = input.retryAfterSeconds;
    this.details = input.details;
  }
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
