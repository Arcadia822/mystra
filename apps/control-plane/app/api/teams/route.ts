import { createTeamRequestSchema } from "@mystra/shared";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { authorizationErrorResponse, requireHumanSession, requireTeamPermission } from "../_auth";

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "team-list");
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    const teams = await db.listActiveTeamsForUser(subject.user.id);
    return NextResponse.json({
      teams: teams.map((team) => ({ ...team, isActive: team.id === active.team.id })),
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "team-create");
    const input = createTeamRequestSchema.parse(await request.json());
    const created = await db.createTeam(subject.user.id, input.displayName);
    return NextResponse.json({
      team: {
        ...created.team,
        currentUserRole: created.ownerMembership.role,
      },
    }, { status: 201 });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
