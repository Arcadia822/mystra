import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { bearerToken } from "@/lib/http";

export async function POST(request: Request) {
  const db = getDb();
  const runner = db.authenticateRunner(bearerToken(request));
  if (!runner) {
    return NextResponse.json({ error: "runner_unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ runner: db.heartbeatRunner(runner.id) });
}
