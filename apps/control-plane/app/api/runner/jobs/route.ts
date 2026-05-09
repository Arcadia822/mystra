import { NextResponse } from "next/server";

import { bearerToken } from "@/lib/http";
import { authenticateRunner, claimNextLocalRun } from "@/lib/local-store";

export const runtime = "nodejs";
export const maxDuration = 30;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: Request) {
  const runner = authenticateRunner(bearerToken(request));
  if (!runner) {
    return NextResponse.json({ error: "runner_unauthorized" }, { status: 401 });
  }

  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    const snapshot = claimNextLocalRun(runner);
    if (snapshot) {
      return NextResponse.json({ job: snapshot.job, run: snapshot.run });
    }

    await sleep(500);
  }

  return NextResponse.json({ job: null, run: null });
}
