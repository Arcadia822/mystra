import { NextResponse } from "next/server";
import { workflowErrorResponseSchema } from "@mystra/shared";

import { WorkflowFailure, workflowHttpStatus } from "@/lib/workflows/workflow-errors";
import { authorizationErrorResponse } from "./_auth";

export function workflowRouteError(error: unknown): NextResponse {
  try {
    return authorizationErrorResponse(error);
  } catch {
    const inheritedCode = error && typeof error === "object" && "code" in error
      && ["capability_expired", "scope_mismatch", "invalid_request"].includes(String(error.code))
      ? String(error.code) as "capability_expired" | "scope_mismatch" | "invalid_request"
      : undefined;
    const failure = error instanceof WorkflowFailure
      ? error
      : inheritedCode
        ? new WorkflowFailure(inheritedCode, error instanceof Error ? error.message : inheritedCode)
        : new WorkflowFailure("control_plane_unavailable", "Workflow service is unavailable", true);
    return NextResponse.json(workflowErrorResponseSchema.parse({
      error: { code: failure.code, message: failure.message, retryable: failure.retryable },
    }), { status: workflowHttpStatus(failure.code) });
  }
}
