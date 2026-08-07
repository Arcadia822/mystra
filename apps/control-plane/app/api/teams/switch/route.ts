import { switchTeamRequestSchema } from "@mystra/shared";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { authorizationErrorResponse, requireHumanSession } from "../../_auth";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "team-switch");
    const input = switchTeamRequestSchema.parse(await request.json());
    await db.setActiveTeam(subject.session.id, input.teamId);
    const active = await db.resolveActiveTeam(subject.session.id);
    if (!active) throw new Error("active-team-unavailable");
    return NextResponse.json({
      team: { ...active.team, currentUserRole: active.role },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "active-team-unavailable") {
      return NextResponse.json(
        { error: { code: "forbidden", message: "forbidden" } },
        { status: 403 },
      );
    }
    return authorizationErrorResponse(error);
  }
}
