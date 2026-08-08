import { NextResponse } from "next/server";
import { agentArchiveRequestSchema, agentResponseSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";
import { managementError, managementException } from "@/lib/management-http";
import {
  authorizationErrorResponse,
  requireHumanSession,
  requireTeamPermission,
} from "../../../_auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "agent-archive");
    const active = await requireTeamPermission(db, subject, "team.settings.manage");
    const input = agentArchiveRequestSchema.parse(await request.json());
    const { id } = await context.params;
    const agent = await db.archiveAgent(id, { ...input, teamId: active.team.id });
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
