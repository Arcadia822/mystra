import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { registerLocalRunner } from "@/lib/local-store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const session = registerLocalRunner({
      runnerName: String(body.runnerName ?? "local-runner"),
      capabilities: typeof body.capabilities === "object" && body.capabilities !== null ? body.capabilities : undefined,
      maxConcurrency: Number(body.maxConcurrency ?? 1),
    });

    return NextResponse.json({
      runnerSessionId: session.id,
      runnerToken: session.token,
    });
  } catch (error) {
    return jsonError(error);
  }
}
