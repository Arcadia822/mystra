import { NextResponse } from "next/server";

import { bearerToken, jsonError } from "@/lib/http";
import { appendLocalRunEvent, authenticateRunner } from "@/lib/local-store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const runner = authenticateRunner(bearerToken(request));
  if (!runner) {
    return NextResponse.json({ error: "runner_unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const event = appendLocalRunEvent(runner, id, await request.json());
    return NextResponse.json({ event });
  } catch (error) {
    return jsonError(error, 400);
  }
}
