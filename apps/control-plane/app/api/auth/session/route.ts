import { NextResponse } from "next/server";

import { toAccountView } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { authorizationErrorResponse, requireHumanSession } from "../../_auth";

export async function GET(request: Request) {
  try {
    const subject = await requireHumanSession(await getDb(), request, "session");
    const response = NextResponse.json({
      user: toAccountView(subject.user),
      session: {
        id: subject.session.id,
        createdAt: subject.session.createdAt,
        expiresAt: subject.session.expiresAt,
        current: true,
        ...(subject.session.ipAddress ? { ipAddress: subject.session.ipAddress } : {}),
        ...(subject.session.userAgent ? { userAgent: subject.session.userAgent } : {}),
      },
    });
    response.headers.set("cache-control", "no-store");
    return response;
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
