import { sessionResponseSchema } from "@mystra/shared";
import { NextResponse } from "next/server";

import { requireHumanSession, requireTeamPermission } from "../../_auth";
import { getDb } from "@/lib/db";
import { noStore, sessionErrorResponse } from "../../_session-http";
import { createSessionService } from "@/lib/sessions/session-service-factory";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await context.params;
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "session-read");
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    const session = await createSessionService(db).get({
      actor: { actorId: subject.user.id, teamId: active.team.id, roles: [active.role] },
      sessionId,
    });
    return noStore(NextResponse.json(sessionResponseSchema.parse({ session })));
  } catch (error) {
    return sessionErrorResponse(error);
  }
}
