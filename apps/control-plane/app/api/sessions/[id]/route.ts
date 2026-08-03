import { NextResponse } from "next/server";
import { sessionDetailResponseSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";
import { managementError } from "@/lib/management-http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const db = getDb();
  const session = db.getSession(id);
  if (!session) {
    return managementError("SESSION_NOT_FOUND", `Session not found: ${id}`, 404);
  }
  const task = db.getTask(session.taskId);
  if (!task) {
    return managementError("TASK_NOT_FOUND", `Task not found: ${session.taskId}`, 404);
  }
  return NextResponse.json(sessionDetailResponseSchema.parse({ session, task }));
}
