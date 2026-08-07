import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";

export async function GET() {
  const checkedAt = new Date().toISOString();
  const db = await getDb();
  const tasks = await db.listTasks();

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
}
