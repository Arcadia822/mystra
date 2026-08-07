import { addMemberRequestSchema } from "@mystra/shared";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { rolePermissions } from "@/lib/rbac";
import { authorizationErrorResponse, requireHumanSession, requireTeamPermission } from "../../../_auth";

export async function GET(
  request: Request,
  context: { params: Promise<{ teamId: string }> },
) {
  try {
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "member-list");
    const { teamId } = await context.params;
    const active = await requireTeamPermission(db, subject, "team.resource.access", teamId);
    const members = await db.listMembers(teamId);
    return NextResponse.json({
      members: members.map((member) => ({
        ...member,
        allowedActions: rolePermissions[active.role],
      })),
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ teamId: string }> },
) {
  try {
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "member-add");
    const { teamId } = await context.params;
    await requireTeamPermission(db, subject, "team.member.manage", teamId);
    const input = addMemberRequestSchema.parse(await request.json());
    const member = await db.addMemberByUsername(teamId, input.username);
    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && /User does not exist/i.test(error.message)) {
      return NextResponse.json({ error: { code: "not-found", message: "not-found" } }, { status: 404 });
    }
    if (error instanceof Error && /already a Team member/i.test(error.message)) {
      return NextResponse.json({ error: { code: "conflict", message: "conflict" } }, { status: 409 });
    }
    return authorizationErrorResponse(error);
  }
}
