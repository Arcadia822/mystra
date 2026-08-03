import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { bearerToken } from "@/lib/http";

export async function POST(request: Request) {
  const db = getDb();
  const runner = db.authenticateRunner(bearerToken(request));
  if (!runner) {
    return NextResponse.json({ error: "runner_unauthorized" }, { status: 401 });
  }

  const body = z.object({
    runnerId: z.string().uuid(),
    activeSessionIds: z.array(z.string().uuid()).default([]),
  }).strict().parse(await request.json());
  if (body.runnerId !== runner.id) {
    return NextResponse.json({ error: { code: "RUNNER_ID_MISMATCH", message: "Credential does not own runnerId" } }, { status: 403 });
  }
  return NextResponse.json({ runner: db.heartbeatRunner(runner.id, body.activeSessionIds) });
}
