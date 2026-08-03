import { NextResponse } from "next/server";
import { runnerClaimResponseSchema, runnerPollRequestSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";
import { bearerToken } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const db = getDb();
  const runner = db.authenticateRunner(bearerToken(request));
  if (!runner) {
    return NextResponse.json({ error: { code: "RUNNER_UNAUTHORIZED", message: "Runner credential is invalid" } }, { status: 401 });
  }
  const body = runnerPollRequestSchema.parse(await request.json());
  if (body.runnerId !== runner.id) {
    return NextResponse.json({ error: { code: "RUNNER_ID_MISMATCH", message: "Credential does not own runnerId" } }, { status: 403 });
  }
  const claim = db.claimNextSession(runner.id);
  if (!claim) {
    return new NextResponse(null, { status: 204 });
  }
  return NextResponse.json(runnerClaimResponseSchema.parse(claim));
}
