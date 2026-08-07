import { NextResponse } from "next/server";
import { projectUpdateRequestSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";
import {
  authorizationErrorResponse,
  requireHumanSession,
  requireTeamPermission,
} from "../../_auth";

function projectError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "project-read");
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    const project = await db.getProjectBySlug(slug, { teamId: active.team.id });
    if (!project) {
      return projectError("PROJECT_NOT_FOUND", `Project not found: ${slug}`, 404);
    }
    return NextResponse.json({ project });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const parsed = projectUpdateRequestSchema.parse(await request.json());
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "project-update");
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    const current = await db.getProjectBySlug(slug, { teamId: active.team.id });
    if (!current) {
      return projectError("PROJECT_NOT_FOUND", `Project not found: ${slug}`, 404);
    }
    const project = await db.updateProject(slug, parsed);
    if (!project) {
      return projectError("PROJECT_NOT_FOUND", `Project not found: ${slug}`, 404);
    }
    return NextResponse.json({ project });
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

export async function DELETE(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "project-delete");
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    const current = await db.getProjectBySlug(slug, { teamId: active.team.id });
    if (!current) {
      return projectError("PROJECT_NOT_FOUND", `Project not found: ${slug}`, 404);
    }
    const project = await db.archiveProject(slug);
    return NextResponse.json({ project });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
