import { NextResponse } from "next/server";
import { projectUpdateSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";

function projectError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const project = getDb().getProjectBySlug(slug);
  if (!project) {
    return projectError("PROJECT_NOT_FOUND", `Project not found: ${slug}`, 404);
  }
  return NextResponse.json({ project });
}

export async function PATCH(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const project = getDb().updateProject(slug, projectUpdateSchema.parse(await request.json()));
    if (!project) {
      return projectError("PROJECT_NOT_FOUND", `Project not found: ${slug}`, 404);
    }
    return NextResponse.json({ project });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("PROJECT_SLUG_CONFLICT")) {
      return projectError("PROJECT_SLUG_CONFLICT", message, 409);
    }
    return projectError("INVALID_PROJECT", message || "Invalid project payload", 400);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const project = getDb().archiveProject(slug);
  if (!project) {
    return projectError("PROJECT_NOT_FOUND", `Project not found: ${slug}`, 404);
  }
  return NextResponse.json({ project });
}
