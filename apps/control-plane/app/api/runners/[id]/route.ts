import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const db = getDb();
  const runner = db.listRunners().find((candidate) => candidate.id === id);

  if (!runner) {
    return NextResponse.json(
      {
        error: {
          code: "RUNNER_NOT_FOUND",
          message: `Runner not found: ${id}`,
        },
      },
      { status: 404 },
    );
  }

  const assignedTasks = db
    .listJobs()
    .filter((snapshot) => snapshot.run.assignedRunnerSessionId === runner.id);

  return NextResponse.json({ runner, assignedTasks });
}
