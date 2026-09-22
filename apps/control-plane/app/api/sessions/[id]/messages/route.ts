import {
  sessionSendMessageHttpInputSchema,
  sessionSendMessageResponseSchema,
} from "@mystra/shared";
import { NextResponse } from "next/server";

import { requireHumanSession, requireTeamPermission } from "../../../_auth";
import { getDb } from "@/lib/db";
import { noStore, sessionErrorResponse } from "../../../_session-http";
import { createSessionService } from "@/lib/sessions/session-service-factory";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sessionId } = await context.params;
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "session-send-message");
    const active = await requireTeamPermission(db, subject, "team.resource.access");

    const json = await request.json().catch(() => ({}));
    const input = sessionSendMessageHttpInputSchema.parse(json);

    const result = await createSessionService(db).sendMessage({
      actor: { actorId: subject.user.id, teamId: active.team.id, roles: [active.role] },
      sessionId,
      request: input,
    });

    const status = 202;
    return noStore(NextResponse.json(sessionSendMessageResponseSchema.parse(result), { status }));
  } catch (error) {
    return sessionErrorResponse(error);
  }
}
