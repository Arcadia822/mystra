import { z } from "zod";
import { NextResponse } from "next/server";

import { changeDisplayName } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { authorizationErrorResponse, requireHumanSession } from "../../_auth";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "account-display-name");
    const user = await changeDisplayName(db, await request.json(), subject.user.id);
    const response = NextResponse.json({ user });
    response.headers.set("cache-control", "no-store");
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "invalid-request", message: "invalid-request" } },
        { status: 400 },
      );
    }
    return authorizationErrorResponse(error);
  }
}
