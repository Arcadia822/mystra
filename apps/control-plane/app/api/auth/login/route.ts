import { NextResponse } from "next/server";

import {
  AuthError,
  LocalAuthService,
  assertNewSessionRequestOrigin,
  serializeSessionCookie,
  sessionCookieOptions,
} from "@/lib/auth";
import { getDb } from "@/lib/db";

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
    const result = await new LocalAuthService(await getDb()).login(
      await request.json(),
      requestContext(request),
    );
    const response = NextResponse.json({ user: result.user });
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
    const status = error instanceof AuthError && error.code === "login-rate-limited"
      ? 429
      : error instanceof AuthError && error.code === "csrf-failed"
        ? 403
        : 401;
    return NextResponse.json(
      {
        error: {
          code: status === 429 ? "login-rate-limited" : status === 403 ? "csrf-failed" : "invalid-credentials",
          message: status === 429 ? "login-rate-limited" : status === 403 ? "csrf-failed" : "invalid-credentials",
        },
      },
      { status },
    );
  }
}
