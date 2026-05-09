import { NextResponse } from "next/server";

import { cancelLocalJob } from "@/lib/local-store";
import { jsonError } from "@/lib/http";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const snapshot = cancelLocalJob(id);
    if (!snapshot) {
      return NextResponse.json({ error: "job_not_found" }, { status: 404 });
    }

    return NextResponse.json(snapshot);
  } catch (error) {
    return jsonError(error);
  }
}
