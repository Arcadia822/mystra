import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { bearerToken, jsonError } from "@/lib/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const runner = db.authenticateRunner(bearerToken(request));
  if (!runner) {
    return NextResponse.json({ error: { code: "RUNNER_UNAUTHORIZED", message: "Runner credential is invalid" } }, { status: 401 });
  }
  try {
    const { id } = await context.params;
    return NextResponse.json({ session: db.completeSession(runner.id, id, await request.json()) });
  } catch (error) {
    return jsonError(error, 400);
  }
}
