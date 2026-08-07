import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { withDerivedHostLiveness } from "@/lib/runtime/runtime-liveness";
import {
  authorizationErrorResponse,
  requireHumanSession,
  requireTeamPermission,
} from "../_auth";

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "runtime-list");
    await requireTeamPermission(db, subject, "team.resource.access");
    const runtimes = await db.listRuntimes();
    return NextResponse.json({ runtimes: runtimes.map((runtime) => withDerivedHostLiveness(runtime)) });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
