import { NextResponse } from "next/server";
import { projectCreateSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";

function projectError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: Request) {
  const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "true";
  return NextResponse.json({ projects: getDb().listProjects({ includeArchived }) });
}

export async function POST(request: Request) {
  try {
    const project = getDb().createProject(projectCreateSchema.parse(await request.json()));
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("PROJECT_SLUG_CONFLICT")) {
      return projectError("PROJECT_SLUG_CONFLICT", message, 409);
    }
    return projectError("INVALID_PROJECT", message || "Invalid project payload", 400);
  }
}
