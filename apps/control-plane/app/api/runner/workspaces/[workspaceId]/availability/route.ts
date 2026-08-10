import { workspaceAvailabilityReportSchema } from "@mystra/shared";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getDb } from "@/lib/db";
import { TaskWorkspaceFailure } from "@/lib/task-workspaces/task-workspace-errors";
import { createWorkspacePreparationService } from "@/lib/task-workspaces/workspace-preparation-service-factory";

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    const report = workspaceAvailabilityReportSchema.parse(await request.json());
    // MVP runner identity is the enrolled stable runnerId; pairing/auth remains owned by feature 044.
    const workspace = await createWorkspacePreparationService(await getDb()).reportMissing({
      workspaceId,
      report,
    });
    return noStore(NextResponse.json({ workspaceId: workspace.id, state: workspace.state }));
  } catch (error) {
    if (error instanceof TaskWorkspaceFailure) {
      return noStore(NextResponse.json({ error: { code: error.code, message: error.message } }, {
        status: error.status,
      }));
    }
    if (error instanceof ZodError) {
      return noStore(NextResponse.json({
        error: { code: "INVALID_WORKSPACE_AVAILABILITY", message: "Invalid Workspace availability payload" },
      }, { status: 400 }));
    }
    return noStore(NextResponse.json({
      error: { code: "INVALID_WORKSPACE_AVAILABILITY", message: "Workspace availability report failed" },
    }, { status: 500 }));
  }
}

function noStore(response: NextResponse): NextResponse {
  response.headers.set("cache-control", "no-store");
  return response;
}
