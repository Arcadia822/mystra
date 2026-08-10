import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { createRuntimeSessionService } from "@/lib/sessions/runtime-session-service-factory";
import { withDerivedHostLiveness } from "@/lib/runtime/runtime-liveness";

export async function POST(request: Request) {
  const runtimeId = request.headers.get("x-mystra-runtime-id");
  if (!runtimeId) return NextResponse.json({ error: { code: "RUNTIME_ID_REQUIRED", message: "Runtime identity is required" } }, { status: 401 });
  try {
    const db = await getDb();
    const service = createRuntimeSessionService(db);
    await service.reconcileExpiredLeases(async (id) => {
      const runtime = await db.getRuntime(id);
      return runtime ? withDerivedHostLiveness(runtime).status === "online" : false;
    });
    const assignment = await service.claim({ runtimeId, request: await request.json() });
    return assignment
      ? NextResponse.json({ assignment })
      : new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: { code: "SESSION_CLAIM_FAILED", message: "Session claim failed" } }, { status: 409 });
  }
}
