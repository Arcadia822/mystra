import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { bearerToken, jsonError } from "@/lib/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const runner = db.authenticateRunner(bearerToken(request));
  if (!runner) {
    return NextResponse.json({ error: "runner_unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const event = db.appendRunEvent(runner.id, id, await request.json());
    return NextResponse.json({ event });
  } catch (error) {
    return jsonError(error, 400);
  }
}
