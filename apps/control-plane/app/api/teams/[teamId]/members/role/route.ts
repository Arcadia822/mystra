import { setMemberRoleRequestSchema } from "@mystra/shared";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { changeMemberRole } from "@/lib/rbac";
import { authorizationErrorResponse, requireHumanSession, requireTeamPermission } from "../../../../_auth";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ teamId: string }> },
) {
  try {
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "member-role");
    const { teamId } = await context.params;
    await requireTeamPermission(db, subject, "team.role.manage", teamId);
    const input = setMemberRoleRequestSchema.parse(await request.json());
    const member = await changeMemberRole(db, subject, input.userId, input.role);
    return NextResponse.json({ member });
  } catch (error) {
    if (error instanceof Error && /last active Team Owner/i.test(error.message)) {
      return NextResponse.json(
        { error: { code: "last-owner-protected", message: "last-owner-protected" } },
        { status: 409 },
      );
    }
    return authorizationErrorResponse(error);
  }
}
