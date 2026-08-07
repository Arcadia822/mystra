import { z } from "zod";
import { NextResponse } from "next/server";

import { clearSessionCookie, sessionCookieOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { authorizationErrorResponse, requireHumanSession } from "../../../_auth";

const revokeSessionRequestSchema = z.object({
  sessionId: z.string().uuid(),
}).strict();

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "session-revoke");
    const input = revokeSessionRequestSchema.parse(await request.json());
    const revoked = await db.deleteAuthSessionForUser(subject.user.id, input.sessionId);
    if (!revoked) {
      return NextResponse.json(
        { error: { code: "not-found", message: "not-found" } },
        { status: 404 },
      );
    }
    const response = new NextResponse(null, { status: 204 });
    if (subject.source === "cookie" && input.sessionId === subject.session.id) {
      response.headers.set("set-cookie", clearSessionCookie(sessionCookieOptions(request)));
    }
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
