import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const snapshot = getDb().getJob(id);
  if (!snapshot) {
    return NextResponse.json({ error: "job_not_found" }, { status: 404 });
  }

  return NextResponse.json(snapshot);
}
