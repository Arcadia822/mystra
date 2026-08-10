import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { RdbError } from "@/lib/db/prisma-errors";
import { SessionFailure } from "@/lib/sessions/session-errors";
import { authorizationErrorResponse } from "./_auth";

export function sessionErrorResponse(
  error: unknown,
  invalidCode: "invalid_request" | "event_window_invalid" = "invalid_request",
): NextResponse {
  try {
    return noStore(authorizationErrorResponse(error));
  } catch {
    if (error instanceof SessionFailure || (
      error instanceof Error && error.name === "SessionFailure" && "code" in error
    )) {
      const failure = error as SessionFailure;
      const status = failure.code.endsWith("_not_found") ? 404 : 409;
      return noStore(NextResponse.json({ error: { code: failure.code, message: failure.message } }, { status }));
    }
    if (error instanceof ZodError) {
      return noStore(NextResponse.json({
        error: { code: invalidCode, message: "Request validation failed" },
      }, { status: 400 }));
    }
    if (error instanceof RdbError && error.code === "RDB_NOT_FOUND") {
      return noStore(NextResponse.json({
        error: { code: "session_not_found", message: "Session was not found" },
      }, { status: 404 }));
    }
    return noStore(NextResponse.json({
      error: { code: "session_unavailable", message: "Session request is unavailable" },
    }, { status: 500 }));
  }
}

export function noStore(response: NextResponse): NextResponse {
  response.headers.set("cache-control", "no-store");
  return response;
}
