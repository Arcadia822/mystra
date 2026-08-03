import { NextResponse } from "next/server";
import { coordinationSessionSummaryPayloadSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";
import { managementError } from "@/lib/management-http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const summary = getDb().getSessionSummary(id);
  if (!summary) {
    return managementError("SESSION_NOT_FOUND", `Session not found: ${id}`, 404);
  }
  return NextResponse.json(coordinationSessionSummaryPayloadSchema.parse({ summary }));
}
