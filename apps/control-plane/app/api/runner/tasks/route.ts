import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { bearerToken } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 30;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: Request) {
  const db = getDb();
  const runner = db.authenticateRunner(bearerToken(request));
  if (!runner) {
    return NextResponse.json({ error: "runner_unauthorized" }, { status: 401 });
  }

  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    const snapshot = db.claimNextRun(runner.id);
    if (snapshot) {
      return NextResponse.json({ task: snapshot.task, run: snapshot.run, project: snapshot.project, runtime: snapshot.runtime });
    }

    await sleep(500);
  }

  return NextResponse.json({ task: null, run: null, project: null, runtime: null });
}
