import { NextResponse } from "next/server";
import {
  agentCreateRequestSchema,
  agentListQuerySchema,
  agentPageSchema,
  agentResponseSchema,
} from "@mystra/shared";

import { getDb } from "@/lib/db";
import { managementException } from "@/lib/management-http";
import {
  authorizationErrorResponse,
  requireHumanSession,
  requireTeamPermission,
} from "../_auth";

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "agent-list");
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    const query = agentListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return NextResponse.json(agentPageSchema.parse(await db.listAgents({
      teamId: active.team.id,
      limit: query.limit,
      includeArchived: query.includeArchived,
      ...(query.cursor ? { cursor: query.cursor } : {}),
    })));
  } catch (error) {
    try {
      return authorizationErrorResponse(error);
    } catch {
      return managementException(error, "INVALID_AGENT");
    }
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "agent-create");
    const active = await requireTeamPermission(db, subject, "team.settings.manage");
    const input = agentCreateRequestSchema.parse(await request.json());
    const agent = await db.createAgent({ ...input, teamId: active.team.id });
    return NextResponse.json(agentResponseSchema.parse({ agent }), { status: 201 });
  } catch (error) {
    try {
      return authorizationErrorResponse(error);
    } catch {
      return managementException(error, "INVALID_AGENT");
    }
  }
}
