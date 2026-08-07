import { NextResponse } from "next/server";
import { taskDetailResponseSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";
import { managementError } from "@/lib/management-http";
import {
  authorizationErrorResponse,
  requireHumanSession,
  requireTeamPermission,
} from "../../_auth";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "task-read");
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    const task = await db.getTask(id, { teamId: active.team.id });
    if (!task) {
      return managementError("TASK_NOT_FOUND", `Task not found: ${id}`, 404);
    }
    return NextResponse.json(taskDetailResponseSchema.parse({ task }));
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
