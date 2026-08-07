import { runtimeRenameSchema } from "@mystra/shared";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { withDerivedHostLiveness } from "@/lib/runtime/runtime-liveness";
import {
  authorizationErrorResponse,
  requireHumanSession,
  requireTeamPermission,
} from "../../_auth";

function runtimeError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "runtime-read");
    await requireTeamPermission(db, subject, "team.resource.access");
    const runtime = await db.getRuntime(id);
    if (!runtime) {
      return runtimeError("RUNTIME_NOT_FOUND", "Runtime not found", 404);
    }
    return NextResponse.json({ runtime: withDerivedHostLiveness(runtime) });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = runtimeRenameSchema.parse(await request.json());
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "runtime-rename");
    await requireTeamPermission(db, subject, "team.resource.access");
    const runtime = await db.renameRuntime(id, input);
    if (!runtime) {
      return runtimeError("RUNTIME_NOT_FOUND", "Runtime not found", 404);
    }
    return NextResponse.json({ runtime: withDerivedHostLiveness(runtime) });
  } catch (error) {
    try {
      return authorizationErrorResponse(error);
    } catch {
      return runtimeError("INVALID_RUNTIME_RENAME", "Invalid Runtime rename payload", 400);
    }
  }
}
