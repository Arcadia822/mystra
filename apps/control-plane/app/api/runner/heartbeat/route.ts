import { hostHeartbeatSchema } from "@mystra/shared";
import { NextResponse } from "next/server";

import { getHostLivenessRegistry } from "@/lib/runtime/runtime-liveness";

function runnerError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  try {
    const { runnerId } = hostHeartbeatSchema.parse(await request.json());
    const registry = getHostLivenessRegistry();
    if (registry.getLastSeen(runnerId) === null) {
      return runnerError("RUNNER_NOT_FOUND", "Runner not found", 404);
    }

    // MVP exception: runner liveness ingestion is deliberately unauthenticated until pairing exists.
    const acknowledgedAt = new Date();
    registry.markSeen(runnerId, acknowledgedAt);
    return NextResponse.json({ acknowledgedAt: acknowledgedAt.toISOString() });
  } catch {
    return runnerError("INVALID_HOST_HEARTBEAT", "Invalid host Runtime heartbeat payload", 400);
  }
}
