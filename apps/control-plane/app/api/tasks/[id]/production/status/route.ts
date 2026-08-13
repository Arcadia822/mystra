import { NextResponse } from "next/server";
import { taskStatusTransitionResultSchema, taskStatusViewSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";
import { createTaskStatusService } from "@/lib/tasks/task-status-service-factory";
import { authorizationErrorResponse, requireHumanSession, requireTeamPermission } from "../../../../_auth";
import { noStore, taskProductionErrorResponse } from "../../../../_task-production-http";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { id: taskId } = await context.params;
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "task-production-status-read");
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    const status = await createTaskStatusService(db).get({ teamId: active.team.id, taskId, actorPolicy: "human" });
    return noStore(NextResponse.json(taskStatusViewSchema.parse(status)));
  } catch (error) {
    try { return noStore(authorizationErrorResponse(error)); } catch { return taskProductionErrorResponse(error); }
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { id: taskId } = await context.params;
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "task-production-status-update");
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    const result = await createTaskStatusService(db).transition({
      teamId: active.team.id,
      taskId,
      actorPolicy: "human",
      actor: { kind: "human", actorId: subject.user.id, agentId: null, harnessId: null, sessionId: null },
      request: await request.json(),
    });
    return noStore(NextResponse.json(taskStatusTransitionResultSchema.parse(result)));
  } catch (error) {
    try { return noStore(authorizationErrorResponse(error)); } catch { return taskProductionErrorResponse(error); }
  }
}
