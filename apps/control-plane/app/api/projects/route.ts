import { NextResponse } from "next/server";
import { projectCreateRequestSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";
import { IntegrationFailure, integrationErrorResponse } from "@/lib/integrations/errors";
import { defaultIntegrationRegistry } from "@/lib/integrations/registry";
import { resolveProjectCreateInput } from "@/lib/projects/resolve-project-input";

function projectError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: Request) {
  const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "true";
  return NextResponse.json({ projects: getDb().listProjects({ includeArchived }) });
}

export async function POST(request: Request) {
  try {
    const parsed = projectCreateRequestSchema.parse(await request.json());
    const resolved = await resolveProjectCreateInput(parsed, defaultIntegrationRegistry());
    const project = getDb().createProject(resolved);
    return NextResponse.json({ project }, { status: 201 });
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
