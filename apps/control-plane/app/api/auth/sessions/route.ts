import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { authorizationErrorResponse, requireHumanSession } from "../../_auth";

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "session-list");
    const now = Date.now();
    const sessions = (await db.listAuthSessionsForUser(subject.user.id))
      .filter((session) => new Date(session.expiresAt).getTime() > now)
      .map((session) => ({
        id: session.id,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        current: session.id === subject.session.id,
        ...(session.ipAddress ? { ipAddress: session.ipAddress } : {}),
        ...(session.userAgent ? { userAgent: session.userAgent } : {}),
      }));
    const response = NextResponse.json({ sessions });
    response.headers.set("cache-control", "no-store");
    return response;
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
