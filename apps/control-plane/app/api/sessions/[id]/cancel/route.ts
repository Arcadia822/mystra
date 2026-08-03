import { NextResponse } from "next/server";
import { cancelSessionResponseSchema, sessionCancellationRequestSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";
import { managementException } from "@/lib/management-http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = sessionCancellationRequestSchema.parse(await request.json());
    const response = getDb().cancelSession(id, body);
    return NextResponse.json(cancelSessionResponseSchema.parse(response));
  } catch (error) {
    return managementException(error, "SESSION_CANCEL_CONFLICT", 409);
  }
}
