import { removeMemberRequestSchema } from "@mystra/shared";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { removeMember } from "@/lib/rbac";
import { authorizationErrorResponse, requireHumanSession, requireTeamPermission } from "../../../../_auth";

export async function POST(
  request: Request,
  context: { params: Promise<{ teamId: string }> },
) {
  try {
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "member-remove");
    const { teamId } = await context.params;
    await requireTeamPermission(db, subject, "team.member.manage", teamId);
    const input = removeMemberRequestSchema.parse(await request.json());
    await removeMember(db, subject, input.userId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && /last active Team Owner/i.test(error.message)) {
      return NextResponse.json(
        { error: { code: "last-owner-protected", message: "last-owner-protected" } },
        { status: 409 },
      );
    }
    if (error instanceof Error && /last active Team/i.test(error.message)) {
      return NextResponse.json(
        { error: { code: "last-active-team-protected", message: "last-active-team-protected" } },
        { status: 409 },
      );
    }
    return authorizationErrorResponse(error);
  }
}
