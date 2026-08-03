import { NextResponse } from "next/server";
import { runnerClaimResponseSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";
import { bearerToken } from "@/lib/http";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const runner = db.authenticateRunner(bearerToken(request));
  if (!runner) {
    return NextResponse.json({ error: { code: "RUNNER_UNAUTHORIZED", message: "Runner credential is invalid" } }, { status: 401 });
  }
  const { id } = await context.params;
  const claim = db.getSessionClaim(runner.id, id);
  if (!claim) {
    return NextResponse.json({ error: { code: "SESSION_ASSIGNMENT_MISMATCH", message: "Session is not assigned to this Runner" } }, { status: 404 });
  }
  return NextResponse.json(runnerClaimResponseSchema.parse(claim));
}
