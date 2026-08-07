import { NextResponse } from "next/server";

import { clearSessionCookie, sessionCookieOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { authorizationErrorResponse, requireHumanSession } from "../../_auth";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "logout");
    await db.deleteAuthSession(subject.session.id);
    const response = new NextResponse(null, { status: 204 });
    response.headers.set("set-cookie", clearSessionCookie(sessionCookieOptions(request)));
    response.headers.set("cache-control", "no-store");
    return response;
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
