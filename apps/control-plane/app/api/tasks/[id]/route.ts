import { NextResponse } from "next/server";
import { taskDetailResponseSchema, taskUpdateRequestSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";
import { managementError, managementException } from "@/lib/management-http";
import { createTaskService } from "@/lib/tasks/task-service-factory";
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
    const issueResolution = task.issue
      ? await (await createTaskService(db)).resolveIssue(task)
      : undefined;
    return NextResponse.json(taskDetailResponseSchema.parse({
      task,
      ...(issueResolution ? { issueResolution } : {}),
    }));
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "task-update");
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    const input = taskUpdateRequestSchema.parse(await request.json());
    const task = await db.updateTask(id, input, { teamId: active.team.id });
    if (!task) return managementError("TASK_NOT_FOUND", `Task not found: ${id}`, 404);
    return NextResponse.json({ task });
  } catch (error) {
    try {
      return authorizationErrorResponse(error);
    } catch {
      return managementException(error, "INVALID_TASK");
    }
  }
}
