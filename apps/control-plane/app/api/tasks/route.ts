import { NextResponse } from "next/server";
import { manualTaskCreateRequestSchema, taskCreateResponseSchema, taskPageQuerySchema, taskWorkbenchPageSchema } from "@mystra/shared";

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
    const search = new URL(request.url).searchParams;
    const queryInput: Record<string, unknown> = Object.fromEntries(search);
    delete queryInput.status;
    Object.assign(queryInput, {
      cursor: search.get("cursor"),
      limit: search.has("limit") ? Number(search.get("limit")) : undefined,
      query: search.get("query"),
      statuses: search.getAll("status"),
      sort: search.get("sort") ?? undefined,
      direction: search.get("direction") ?? undefined,
    });
    const query = taskPageQuerySchema.parse(queryInput);
    return NextResponse.json(taskWorkbenchPageSchema.parse(
      await db.listTaskPage({ ...query, teamId: active.team.id }),
    ));
  } catch (error) {
    try {
      return authorizationErrorResponse(error);
    } catch {
      return managementException(error, "INVALID_TASK");
    }
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "task-create");
    const input = manualTaskCreateRequestSchema.parse(await request.json());
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    const result = await db.createTask({ ...input, teamId: active.team.id });
    return NextResponse.json(taskCreateResponseSchema.parse(result), { status: result.created ? 201 : 200 });
  } catch (error) {
    try {
      return authorizationErrorResponse(error);
    } catch {
      // Continue with the established Task payload error contract.
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "RDB_RELATION_CONFLICT") {
      return managementException(new Error("PROJECT_NOT_FOUND: Project is unavailable"), "INVALID_TASK");
    }
    return managementException(error, "INVALID_TASK");
  }
}
