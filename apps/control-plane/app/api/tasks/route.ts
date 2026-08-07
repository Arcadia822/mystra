import { NextResponse } from "next/server";
import { taskCreateRequestSchema, taskCreateResponseSchema, taskListResponseSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";
import { managementException } from "@/lib/management-http";
import {
  authorizationErrorResponse,
  requireHumanSession,
  requireTeamPermission,
} from "../_auth";

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "task-list");
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    return NextResponse.json(taskListResponseSchema.parse({
      tasks: await db.listTasks({ teamId: active.team.id }),
    }));
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "task-create");
    const input = taskCreateRequestSchema.parse(await request.json());
    const active = await requireTeamPermission(db, subject, "team.resource.access", input.teamId);
    const task = await db.createTask({ ...input, teamId: active.team.id });
    return NextResponse.json(taskCreateResponseSchema.parse({ task }), { status: 201 });
  } catch (error) {
    try {
      return authorizationErrorResponse(error);
    } catch {
      // Continue with the established Task payload error contract.
    }
    return managementException(error, "INVALID_TASK");
  }
}
