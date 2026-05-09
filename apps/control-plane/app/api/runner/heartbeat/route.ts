import { NextResponse } from "next/server";

import { bearerToken } from "@/lib/http";
import { authenticateRunner, heartbeatRunner } from "@/lib/local-store";

export async function POST(request: Request) {
  const runner = authenticateRunner(bearerToken(request));
  if (!runner) {
    return NextResponse.json({ error: "runner_unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ runner: heartbeatRunner(runner) });
}
