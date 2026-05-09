import { NextResponse } from "next/server";

import { bearerToken, jsonError } from "@/lib/http";
import { authenticateRunner, completeLocalRun } from "@/lib/local-store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const runner = authenticateRunner(bearerToken(request));
  if (!runner) {
    return NextResponse.json({ error: "runner_unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const snapshot = completeLocalRun(runner, id, await request.json());
    return NextResponse.json(snapshot);
  } catch (error) {
    return jsonError(error, 400);
  }
}
