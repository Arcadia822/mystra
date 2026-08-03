import { NextResponse } from "next/server";
import { taskDetailResponseSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";
import { managementError } from "@/lib/management-http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const db = getDb();
  const task = db.getTask(id);
  const sessionSummary = db.getTaskSessionSummary(id);
  if (!task || !sessionSummary) {
    return managementError("TASK_NOT_FOUND", `Task not found: ${id}`, 404);
  }
  return NextResponse.json(taskDetailResponseSchema.parse({ task, sessionSummary }));
}
