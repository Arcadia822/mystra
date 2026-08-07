import { NextResponse } from "next/server";

import { AuthError, LocalAuthService, assertNewSessionRequestOrigin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { serializeSessionCookie, sessionCookieOptions } from "@/lib/auth/session";

function requestContext(request: Request) {
  const ipAddress = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const userAgent = request.headers.get("user-agent") ?? undefined;
  return {
    ...(ipAddress ? { ipAddress } : {}),
    ...(userAgent ? { userAgent } : {}),
  };
}

export async function POST(request: Request) {
  try {
    assertNewSessionRequestOrigin(request);
    const result = await new LocalAuthService(await getDb()).register(
      await request.json(),
      requestContext(request),
    );
    const response = NextResponse.json({ user: result.user }, { status: 201 });
    response.headers.set(
      "set-cookie",
      serializeSessionCookie(
        result.token,
        Math.max(1, Math.floor((new Date(result.session.expiresAt).getTime() - Date.now()) / 1_000)),
        sessionCookieOptions(request),
      ),
    );
    response.headers.set("cache-control", "no-store");
    return response;
  } catch (error) {
    const conflict = error instanceof Error && error.message.startsWith("RDB_CONFLICT");
    const csrf = error instanceof AuthError && error.code === "csrf-failed";
    return NextResponse.json(
      {
        error: {
          code: conflict ? "conflict" : csrf ? "csrf-failed" : "invalid-registration",
          message: conflict ? "conflict" : csrf ? "csrf-failed" : "invalid-registration",
        },
      },
      { status: conflict ? 409 : csrf ? 403 : 400 },
    );
  }
}
