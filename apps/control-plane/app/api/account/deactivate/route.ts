import { NextResponse } from "next/server";

import { clearSessionCookie, sessionCookieOptions } from "@/lib/auth";
import { RdbError } from "@/lib/db/prisma-errors";
import { getDb } from "@/lib/db";
import { authorizationErrorResponse, requireHumanSession } from "../../_auth";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "account-deactivate");
    const deactivated = await db.deactivateLocalUser(subject.user.id);
    if (!deactivated) {
      return NextResponse.json(
        { error: { code: "not-found", message: "not-found" } },
        { status: 404 },
      );
    }
    const response = new NextResponse(null, { status: 204 });
    if (subject.source === "cookie") {
      response.headers.set("set-cookie", clearSessionCookie(sessionCookieOptions(request)));
    }
    response.headers.set("cache-control", "no-store");
    return response;
  } catch (error) {
    if (error instanceof RdbError && error.code === "RDB_CONFLICT") {
      return NextResponse.json(
        { error: { code: "deactivate-forbidden", message: "deactivate-forbidden" } },
        { status: 409 },
      );
    }
    return authorizationErrorResponse(error);
  }
}
