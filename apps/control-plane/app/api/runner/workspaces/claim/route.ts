import {
  workspacePreparationClaimRequestSchema,
  workspacePreparationClaimSchema,
} from "@mystra/shared";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getDb } from "@/lib/db";
import { TaskWorkspaceFailure } from "@/lib/task-workspaces/task-workspace-errors";
import { createWorkspacePreparationService } from "@/lib/task-workspaces/workspace-preparation-service-factory";

export async function POST(request: Request) {
  try {
    const input = workspacePreparationClaimRequestSchema.parse(await request.json());
    // MVP runner identity is the enrolled stable runnerId; pairing/auth remains owned by feature 044.
    const claim = await createWorkspacePreparationService(await getDb()).claim(input);
    if (!claim) return new NextResponse(null, { status: 204 });
    return noStore(NextResponse.json(workspacePreparationClaimSchema.parse(claim)));
  } catch (error) {
    return noStore(runnerWorkspaceError(error, "INVALID_WORKSPACE_CLAIM"));
  }
}

function runnerWorkspaceError(error: unknown, fallbackCode: string): NextResponse {
  if (error instanceof TaskWorkspaceFailure) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: { code: fallbackCode, message: "Invalid Workspace claim payload" } }, { status: 400 });
  }
  return NextResponse.json({ error: { code: fallbackCode, message: "Workspace claim failed" } }, { status: 500 });
}

function noStore(response: NextResponse): NextResponse {
  response.headers.set("cache-control", "no-store");
  return response;
}
