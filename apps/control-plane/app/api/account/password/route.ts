import { z } from "zod";
import { NextResponse } from "next/server";

import { AuthError, changePassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { authorizationErrorResponse, requireHumanSession } from "../../_auth";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "change-password");
    const user = await changePassword(db, await request.json(), subject);
    const response = NextResponse.json({ user });
    response.headers.set("cache-control", "no-store");
    return response;
  } catch (error) {
    if (error instanceof AuthError && error.code === "invalid-credentials") {
      return NextResponse.json(
        { error: { code: "invalid-current-password", message: "invalid-current-password" } },
        { status: 400 },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "invalid-request", message: "invalid-request" } },
        { status: 400 },
      );
    }
    return authorizationErrorResponse(error);
  }
}
