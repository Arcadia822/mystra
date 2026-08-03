import { NextResponse } from "next/server";
import {
  sessionCreateRequestSchema,
  sessionCreateResponseSchema,
  sessionListResponseSchema,
} from "@mystra/shared";

import { getDb } from "@/lib/db";
import { managementException } from "@/lib/management-http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return NextResponse.json(sessionListResponseSchema.parse({ taskId: id, sessions: getDb().listSessions(id) }));
  } catch (error) {
    return managementException(error, "TASK_NOT_FOUND", 404);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = getDb().createSession(id, sessionCreateRequestSchema.parse(await request.json()));
    return NextResponse.json(sessionCreateResponseSchema.parse({ session }), { status: 201 });
  } catch (error) {
    return managementException(error, "INVALID_SESSION");
  }
}
