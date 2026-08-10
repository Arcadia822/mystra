import {
  taskSessionLaunchInputSchema,
  taskSessionLaunchResponseSchema,
  taskSessionListQuerySchema,
  taskSessionPageSchema,
} from "@mystra/shared";
import { NextResponse } from "next/server";

import { requireHumanSession, requireTeamPermission } from "../../../_auth";
import { getDb } from "@/lib/db";
import { sessionErrorResponse, noStore } from "../../../_session-http";
import { createSessionService } from "@/lib/sessions/session-service-factory";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { id: taskId } = await context.params;
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "task-session-list");
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    const query = taskSessionListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const rows = await createSessionService(db).list({
      actor: { actorId: subject.user.id, teamId: active.team.id, roles: [active.role] },
      taskId,
      limit: query.limit + 1,
      ...(query.cursor ? { cursor: query.cursor } : {}),
    });
    const hasMore = rows.length > query.limit;
    const sessions = rows.slice(0, query.limit);
    return noStore(NextResponse.json(taskSessionPageSchema.parse({
      sessions,
      ...(hasMore && sessions.length > 0 ? { nextCursor: sessions.at(-1)!.id } : {}),
    })));
  } catch (error) {
    return sessionErrorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { id: taskId } = await context.params;
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "task-session-launch");
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    const input = taskSessionLaunchInputSchema.parse(await request.json());
    const result = await createSessionService(db).launchForTask({
      actor: { actorId: subject.user.id, teamId: active.team.id, roles: [active.role] },
      taskId,
      request: input,
    });
    return noStore(NextResponse.json(taskSessionLaunchResponseSchema.parse(result), {
      status: result.created ? 201 : 200,
    }));
  } catch (error) {
    return sessionErrorResponse(error);
  }
}
