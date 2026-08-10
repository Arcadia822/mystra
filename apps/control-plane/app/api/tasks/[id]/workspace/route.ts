import {
  taskWorkspaceSetupRequestSchema,
  taskWorkspaceViewSchema,
} from "@mystra/shared";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { authorizationErrorResponse, requireHumanSession, requireTeamPermission } from "../../../_auth";
import { getDb } from "@/lib/db";
import { TaskWorkspaceFailure } from "@/lib/task-workspaces/task-workspace-errors";
import { createTaskWorkspaceService } from "@/lib/task-workspaces/task-workspace-service-factory";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { id: taskId } = await context.params;
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "task-workspace-read");
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    const workspace = await createTaskWorkspaceService(db).get({
      actor: { teamId: active.team.id },
      taskId,
    });
    if (!workspace) {
      throw new TaskWorkspaceFailure("workspace_missing", "Task Workspace has not been set up");
    }
    return noStore(NextResponse.json({ workspace: taskWorkspaceViewSchema.parse(workspace) }));
  } catch (error) {
    return noStore(workspaceErrorResponse(error));
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { id: taskId } = await context.params;
    const setup = taskWorkspaceSetupRequestSchema.parse(await request.json());
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "task-workspace-setup");
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    const result = await createTaskWorkspaceService(db).setup({
      actor: { teamId: active.team.id },
      taskId,
      ...setup,
    });
    const status = result.created || result.retried ? 202 : 200;
    return noStore(NextResponse.json(
      { workspace: taskWorkspaceViewSchema.parse(result.workspace) },
      { status },
    ));
  } catch (error) {
    return noStore(workspaceErrorResponse(error));
  }
}

function workspaceErrorResponse(error: unknown): NextResponse {
  try {
    return authorizationErrorResponse(error);
  } catch {
    if (error instanceof TaskWorkspaceFailure || (
      error instanceof Error
      && error.name === "TaskWorkspaceFailure"
      && "code" in error
      && "status" in error
    )) {
      const failure = error as TaskWorkspaceFailure;
      return NextResponse.json({
        error: { code: failure.code, message: failure.message },
      }, { status: failure.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({
        error: { code: "INVALID_REQUEST", message: "Request validation failed" },
      }, { status: 400 });
    }
    return NextResponse.json({
      error: { code: "workspace_missing", message: "Task Workspace is unavailable" },
    }, { status: 500 });
  }
}

function noStore(response: NextResponse): NextResponse {
  response.headers.set("cache-control", "no-store");
  return response;
}
