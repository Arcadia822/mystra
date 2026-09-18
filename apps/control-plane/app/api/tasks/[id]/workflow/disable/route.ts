import { NextResponse } from "next/server";
import { workflowDisableResponseSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";
import { createWorkflowManagementService } from "@/lib/workflows/workflow-management-service-factory";
import { requireHumanSession, requireTeamPermission } from "../../../../_auth";
import { workflowRouteError } from "../../../../_workflow-http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "task-workflow-disable");
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    const { id: taskId } = await context.params;
    const response = await createWorkflowManagementService(db).disable({
      teamId: active.team.id,
      taskId,
      actor: { userId: subject.user.id, role: active.role },
      request: await request.json(),
    });
    return NextResponse.json(workflowDisableResponseSchema.parse(response));
  } catch (error) {
    return workflowRouteError(error);
  }
}
