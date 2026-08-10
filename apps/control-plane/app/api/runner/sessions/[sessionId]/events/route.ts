import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { createRuntimeSessionService } from "@/lib/sessions/runtime-session-service-factory";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const teamId = request.headers.get("x-mystra-team-id");
  const leaseToken = request.headers.get("x-mystra-lease-token");
  if (!teamId || !leaseToken) {
    return NextResponse.json({ error: { code: "SESSION_LEASE_REQUIRED", message: "Session lease is required" } }, { status: 401 });
  }
  try {
    const { sessionId } = await context.params;
    const result = await createRuntimeSessionService(await getDb()).appendEvents({
      sessionId,
      teamId,
      leaseToken,
      batch: await request.json(),
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: { code: "SESSION_EVENT_APPEND_FAILED", message: "Session events were rejected" } }, { status: 409 });
  }
}
