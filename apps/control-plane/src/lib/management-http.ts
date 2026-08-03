import { NextResponse } from "next/server";
import { managementErrorResponseSchema, type ManagementErrorCode } from "@mystra/shared";
import { ZodError } from "zod";

export function managementError(
  code: ManagementErrorCode,
  message: string,
  status: number,
  details?: Record<string, unknown>,
) {
  return NextResponse.json(managementErrorResponseSchema.parse({
    error: { code, message, ...(details ? { details } : {}) },
  }), { status });
}

export function managementException(
  error: unknown,
  fallbackCode: ManagementErrorCode,
  fallbackStatus = 400,
) {
  if (error instanceof ZodError) {
    return managementError(fallbackCode, "Invalid request payload", 400, { issues: error.issues });
  }
  const message = error instanceof Error ? error.message : "Unknown error";
  const prefix = message.split(":", 1)[0] as ManagementErrorCode;
  const statusByCode: Partial<Record<ManagementErrorCode, number>> = {
    PROJECT_NOT_FOUND: 404,
    PROJECT_ARCHIVED: 409,
    TASK_NOT_FOUND: 404,
    SESSION_NOT_FOUND: 404,
    RUNNER_NOT_FOUND: 404,
    SESSION_CANCEL_CONFLICT: 409,
    SESSION_BRANCH_CONFLICT: 409,
    DISPATCH_CONFLICT: 409,
    RUNTIME_POLICY_VIOLATION: 409,
  };
  if (prefix in statusByCode) {
    return managementError(prefix, message, statusByCode[prefix] ?? fallbackStatus);
  }
  return managementError(fallbackCode, message, fallbackStatus);
}
