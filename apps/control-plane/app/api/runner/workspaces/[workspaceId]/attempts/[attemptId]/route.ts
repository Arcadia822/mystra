import { workspacePreparationReportSchema } from "@mystra/shared";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getDb } from "@/lib/db";
import { TaskWorkspaceFailure } from "@/lib/task-workspaces/task-workspace-errors";
import { createWorkspacePreparationService } from "@/lib/task-workspaces/workspace-preparation-service-factory";
import { createTaskProductionService } from "@/lib/tasks/task-production-service-factory";

type Context = { params: Promise<{ workspaceId: string; attemptId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { workspaceId, attemptId } = await context.params;
    const report = workspacePreparationReportSchema.parse(await request.json());
    // MVP runner identity is the enrolled stable runnerId; pairing/auth remains owned by feature 044.
    const db = await getDb();
    const workspace = await createWorkspacePreparationService(db).report({
      workspaceId,
      attemptId,
      report,
    });
    if (workspace.state === "ready") {
      await createTaskProductionService(db).continueAfterWorkspaceReady({
        teamId: workspace.teamId,
        taskId: workspace.taskId,
      });
    }
    return noStore(NextResponse.json({ workspaceId: workspace.id, state: workspace.state }));
  } catch (error) {
    if (error instanceof TaskWorkspaceFailure) {
      return noStore(NextResponse.json({
        error: { code: error.code, message: error.message },
      }, { status: error.status }));
    }
    if (error instanceof ZodError) {
      return noStore(NextResponse.json({
        error: { code: "INVALID_WORKSPACE_REPORT", message: "Invalid Workspace report payload" },
      }, { status: 400 }));
    }
    return noStore(NextResponse.json({
      error: { code: "INVALID_WORKSPACE_REPORT", message: "Workspace report failed" },
    }, { status: 500 }));
  }
}

function noStore(response: NextResponse): NextResponse {
  response.headers.set("cache-control", "no-store");
  return response;
}
