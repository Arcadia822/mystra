import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { bearerToken } from "@/lib/http";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const runner = db.authenticateRunner(bearerToken(request));
  if (!runner) {
    return NextResponse.json({ error: "runner_unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const snapshot = db.getJobByRunId(id);
  if (!snapshot) {
    return NextResponse.json({ error: "run_not_found" }, { status: 404 });
  }
  if (snapshot.run.assignedRunnerSessionId !== runner.id) {
    return NextResponse.json({ error: "runner_not_assigned" }, { status: 403 });
  }

  return NextResponse.json({
    job: snapshot.job,
    run: snapshot.run,
    project: snapshot.project,
    runtime: snapshot.runtime,
  });
}
