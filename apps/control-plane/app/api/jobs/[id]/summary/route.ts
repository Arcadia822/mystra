import { NextResponse } from "next/server";
import { coordinationRunSummaryPayloadSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const summary = getDb().getJobSummary(id);
  if (!summary) {
    return NextResponse.json({ error: "job_not_found" }, { status: 404 });
  }

  return NextResponse.json(coordinationRunSummaryPayloadSchema.parse({ summary }));
}
