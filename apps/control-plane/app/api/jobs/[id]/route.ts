import { NextResponse } from "next/server";

import { getLocalJob } from "@/lib/local-store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const snapshot = getLocalJob(id);
  if (!snapshot) {
    return NextResponse.json({ error: "job_not_found" }, { status: 404 });
  }

  return NextResponse.json(snapshot);
}
