import { hostRuntimeRegistrationSchema } from "@mystra/shared";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { getHostLivenessRegistry } from "@/lib/runtime/runtime-liveness";

function runnerError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  try {
    const input = hostRuntimeRegistrationSchema.parse(await request.json());

    // MVP exception: host runner enrollment is deliberately unauthenticated until pairing exists.
    const runtime = await (await getDb()).registerHostRuntime(input);
    getHostLivenessRegistry().markSeen(input.runnerId, new Date());

    return NextResponse.json({ runtimeId: runtime.id });
  } catch {
    return runnerError(
      "INVALID_HOST_RUNTIME_REGISTRATION",
      "Invalid host Runtime registration payload",
      400,
    );
  }
}
