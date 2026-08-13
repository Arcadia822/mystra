import { NextResponse } from "next/server";
import { taskStartResultSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";
import { createTaskProductionService } from "@/lib/tasks/task-production-service-factory";
import { authorizationErrorResponse, requireHumanSession, requireTeamPermission } from "../../../../_auth";
import { noStore, taskProductionErrorResponse } from "../../../../_task-production-http";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { id: taskId } = await context.params;
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "task-production-start");
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    const result = await createTaskProductionService(db).start({
      actor: { actorId: subject.user.id, teamId: active.team.id },
      taskId,
      request: await request.json(),
    });
    return noStore(NextResponse.json(taskStartResultSchema.parse(result)));
  } catch (error) {
    try { return noStore(authorizationErrorResponse(error)); } catch { return taskProductionErrorResponse(error); }
  }
}
