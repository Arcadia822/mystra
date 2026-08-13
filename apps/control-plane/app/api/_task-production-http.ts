import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { TaskProductionFailure } from "@/lib/tasks/task-production-errors";

export function taskProductionErrorResponse(error: unknown): NextResponse {
  if (error instanceof TaskProductionFailure) {
    const status = error.code === "task_not_found" ? 404
      : error.code === "capability_expired" ? 401
        : error.code === "scope_mismatch" ? 403
          : error.code === "missing_status_note" || error.code === "invalid_request" ? 400
            : 409;
    return noStore(NextResponse.json({ error: { code: error.code, message: error.message } }, { status }));
  }
  if (error instanceof ZodError) {
    return noStore(NextResponse.json({
      error: { code: "invalid_request", message: "Request validation failed" },
    }, { status: 400 }));
  }
  return noStore(NextResponse.json({
    error: { code: "control_plane_unavailable", message: "Task production request failed" },
  }, { status: 500 }));
}

export function executionCode(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([^\s]+)$/u.exec(authorization);
  if (!match) throw new TaskProductionFailure("capability_expired", "Execution capability is missing or expired");
  return match[1]!;
}

export function noStore(response: NextResponse): NextResponse {
  response.headers.set("cache-control", "no-store");
  return response;
}
