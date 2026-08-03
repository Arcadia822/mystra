import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";

const ACTIVE_STATES = new Set(["assigned", "starting", "running"]);
const FAILED_STATES = new Set(["failed", "canceled", "timed_out"]);

export async function GET() {
  const checkedAt = new Date().toISOString();
  const tasks = getDb().listTasks();
  const runners = getDb().listRunners();

  const sessions = tasks.flatMap((task) => getDb().listSessions(task.id));
  const sessionSummary = {
    total: sessions.length,
    queued: sessions.filter((session) => session.state === "queued").length,
    active: sessions.filter((session) => ACTIVE_STATES.has(session.state)).length,
    waitingForReview: sessions.filter((session) => session.state === "waiting_for_review").length,
    succeeded: sessions.filter((session) => session.state === "succeeded").length,
    failed: sessions.filter((session) => FAILED_STATES.has(session.state)).length,
  };

  let online = 0;
  let stale = 0;
  let activeSessions = 0;
  let maxConcurrency = 0;
  for (const runner of runners) {
    if (runner.health === "healthy") online += 1;
    else stale += 1;
    activeSessions += runner.activeSessionCount;
    maxConcurrency += runner.maxConcurrency;
  }

  const recentTasks = [...tasks]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 5);

  return NextResponse.json({
    controlPlane: {
      checkedAt,
      status: stale > 0 || (sessionSummary.queued > 0 && online === 0) ? "degraded" : "ready",
      tasks: {
        total: tasks.length,
        withoutSessions: tasks.filter((task) => task.sessionCount === 0).length,
      },
      sessions: sessionSummary,
      runners: {
        total: runners.length,
        online,
        stale,
        activeSessions,
        maxConcurrency,
        availableCapacity: Math.max(0, maxConcurrency - activeSessions),
      },
      recentTasks,
    },
  });
}
