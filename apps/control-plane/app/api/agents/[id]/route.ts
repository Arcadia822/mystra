import { NextResponse } from "next/server";
import { agentResponseSchema, agentUpdateRequestSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";
import { managementError, managementException } from "@/lib/management-http";
import {
  authorizationErrorResponse,
  requireHumanSession,
  requireTeamPermission,
} from "../../_auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "agent-read");
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    const { id } = await context.params;
    const agent = await db.getAgent(id, { teamId: active.team.id });
    if (!agent) return managementError("AGENT_NOT_FOUND", `Agent not found: ${id}`, 404);
    return NextResponse.json(agentResponseSchema.parse({ agent }));
  } catch (error) {
    try {
      return authorizationErrorResponse(error);
    } catch {
      return managementException(error, "INVALID_AGENT");
    }
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "agent-update");
    const active = await requireTeamPermission(db, subject, "team.settings.manage");
    const input = agentUpdateRequestSchema.parse(await request.json());
    const { id } = await context.params;
    const agent = await db.updateAgent(id, { ...input, teamId: active.team.id });
    if (!agent) return managementError("AGENT_NOT_FOUND", `Agent not found: ${id}`, 404);
    return NextResponse.json(agentResponseSchema.parse({ agent }));
  } catch (error) {
    try {
      return authorizationErrorResponse(error);
    } catch {
      return managementException(error, "INVALID_AGENT");
    }
  }
}
