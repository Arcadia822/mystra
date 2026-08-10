import { sessionEventWindowQuerySchema, sessionEventWindowSchema } from "@mystra/shared";
import { NextResponse } from "next/server";

import { requireHumanSession, requireTeamPermission } from "../../../_auth";
import { getDb } from "@/lib/db";
import { noStore, sessionErrorResponse } from "../../../_session-http";
import { createSessionService } from "@/lib/sessions/session-service-factory";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await context.params;
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "session-events-read");
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    const actor = { actorId: subject.user.id, teamId: active.team.id, roles: [active.role] };
    const query = sessionEventWindowQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const service = createSessionService(db);
    await service.get({ actor, sessionId });
    const descending = query.latest !== undefined || query.beforeSequence !== undefined;
    const page = await service.listEvents({
      actor,
      sessionId,
      limit: query.latest ?? query.limit,
      ...(query.afterSequence !== undefined ? { afterSequence: query.afterSequence } : {}),
      ...(query.beforeSequence !== undefined ? { beforeSequence: query.beforeSequence } : {}),
      ...(descending ? { order: "desc" as const } : {}),
    });
    const events = descending ? [...page.events].reverse() : page.events;
    return noStore(NextResponse.json(sessionEventWindowSchema.parse({
      events,
      ...(page.olderCursor ? { olderCursor: page.olderCursor } : {}),
      ...(events.length > 0 ? { nextAfterSequence: events.at(-1)!.globalSequence } : {}),
    })));
  } catch (error) {
    return sessionErrorResponse(error, "event_window_invalid");
  }
}
