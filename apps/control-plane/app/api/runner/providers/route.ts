import { hostProviderReportSchema } from "@mystra/shared";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { getHostLivenessRegistry } from "@/lib/runtime/runtime-liveness";

function runnerError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  try {
    const { runnerId, providers } = hostProviderReportSchema.parse(await request.json());

    // MVP exception: runner capability ingestion is deliberately unauthenticated until pairing exists.
    const runtime = await (await getDb()).reportHostProviders(runnerId, providers);
    if (!runtime) {
      return runnerError("RUNNER_NOT_FOUND", "Runner not found", 404);
    }

    getHostLivenessRegistry().markSeen(runnerId, new Date());
    return NextResponse.json({ runtime });
  } catch {
    return runnerError("INVALID_HOST_PROVIDER_REPORT", "Invalid host Provider report payload", 400);
  }
}
