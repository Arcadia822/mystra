import { NextResponse } from "next/server";
import { projectUpdateRequestSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";
import { IntegrationFailure, integrationErrorResponse } from "@/lib/integrations/errors";
import { defaultIntegrationRegistry } from "@/lib/integrations/registry";
import { resolveProjectUpdateInput } from "@/lib/projects/resolve-project-input";

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
    const parsed = projectUpdateRequestSchema.parse(await request.json());
    const resolved = await resolveProjectUpdateInput(parsed, defaultIntegrationRegistry());
    const project = getDb().updateProject(slug, resolved);
    if (!project) {
      return projectError("PROJECT_NOT_FOUND", `Project not found: ${slug}`, 404);
    }
    return NextResponse.json({ project });
  } catch (error) {
    if (error instanceof IntegrationFailure) {
      return integrationErrorResponse(error);
    }
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
