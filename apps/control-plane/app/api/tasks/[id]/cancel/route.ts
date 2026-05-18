import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { jsonError } from "@/lib/http";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const outcome = getDb().cancelTask(id);
    return NextResponse.json(outcome);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("TASK_NOT_FOUND")) {
      return NextResponse.json({ error: "task_not_found" }, { status: 404 });
    }
    return jsonError(error);
  }
}
