import { renameTeamRequestSchema } from "@mystra/shared";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { authorizationErrorResponse, requireHumanSession, requireTeamPermission } from "../../_auth";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ teamId: string }> },
) {
  try {
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "team-rename");
    const { teamId } = await context.params;
    await requireTeamPermission(db, subject, "team.settings.manage", teamId);
    const input = renameTeamRequestSchema.parse(await request.json());
    const team = await db.renameTeam(teamId, input.displayName);
    if (!team) {
      return NextResponse.json({ error: { code: "not-found", message: "not-found" } }, { status: 404 });
    }
    return NextResponse.json({ team: { ...team, currentUserRole: "owner" } });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ teamId: string }> },
) {
  try {
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "team-delete");
    const { teamId } = await context.params;
    await requireTeamPermission(db, subject, "team.delete", teamId);
    const team = await db.archiveTeam(teamId);
    if (!team) {
      return NextResponse.json({ error: { code: "not-found", message: "not-found" } }, { status: 404 });
    }
    return NextResponse.json({ team: { ...team, currentUserRole: "owner" } });
  } catch (error) {
    if (error instanceof Error && /last active Team/i.test(error.message)) {
      return NextResponse.json(
        { error: { code: "delete-forbidden: last-active-team", message: "delete-forbidden: last-active-team" } },
        { status: 409 },
      );
    }
    return authorizationErrorResponse(error);
  }
}
