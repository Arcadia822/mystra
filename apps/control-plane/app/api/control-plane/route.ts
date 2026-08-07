import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import {
  authorizationErrorResponse,
  requireHumanSession,
  requireTeamPermission,
} from "../_auth";

export async function GET(request: Request) {
  try {
    const checkedAt = new Date().toISOString();
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "control-plane-read");
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    const tasks = await db.listTasks({ teamId: active.team.id });

    const recentTasks = [...tasks]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, 5);

    return NextResponse.json({
      controlPlane: {
        checkedAt,
        status: "ready",
        tasks: { total: tasks.length },
        temporarilyUnavailable: ["sessions", "runners", "contextBundles"],
        recentTasks,
      },
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
