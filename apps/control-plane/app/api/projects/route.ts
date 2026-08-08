import { NextResponse } from "next/server";
import { projectCreateRequestSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";
import {
  authorizationErrorResponse,
  requireHumanSession,
  requireTeamPermission,
} from "../_auth";

function projectError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: Request) {
  try {
    const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "true";
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "project-list");
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    return NextResponse.json({
      projects: await db.listProjects({ includeArchived, teamId: active.team.id }),
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = projectCreateRequestSchema.parse(await request.json());
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "project-create");
    const active = await requireTeamPermission(
      db,
      subject,
      "team.resource.access",
    );
    const project = await db.createProject({ ...parsed, teamId: active.team.id });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    try {
      return authorizationErrorResponse(error);
    } catch {
      // Continue with the established project payload error contract.
    }
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("PROJECT_SLUG_CONFLICT")) {
      return projectError("PROJECT_SLUG_CONFLICT", message, 409);
    }
    return projectError("INVALID_PROJECT", message || "Invalid project payload", 400);
  }
}
