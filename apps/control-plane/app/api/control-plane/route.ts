import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";

const ACTIVE_STATES = new Set(["assigned", "starting", "running"]);
const FAILED_STATES = new Set(["failed", "canceled", "timed_out"]);

export async function GET() {
  const checkedAt = new Date().toISOString();
  const checkedAtMs = new Date(checkedAt).getTime();
  const jobs = getDb().listJobs();
  const runners = getDb().listRunners();

  const taskSummary = {
    total: jobs.length,
    queued: 0,
    active: 0,
    waitingForReview: 0,
    succeeded: 0,
    failed: 0,
  };

  for (const snapshot of jobs) {
    const state = snapshot.run.state;
    if (state === "queued") taskSummary.queued += 1;
    else if (ACTIVE_STATES.has(state)) taskSummary.active += 1;
    else if (state === "waiting_for_review") taskSummary.waitingForReview += 1;
    else if (state === "succeeded") taskSummary.succeeded += 1;
    else if (FAILED_STATES.has(state)) taskSummary.failed += 1;
  }

  let online = 0;
  let stale = 0;
  let activeRuns = 0;
  let maxConcurrency = 0;
  for (const runner of runners) {
    const heartbeatAgeMs = checkedAtMs - new Date(runner.lastHeartbeatAt).getTime();
    if (heartbeatAgeMs <= runner.staleAfterSeconds * 1_000) online += 1;
    else stale += 1;
    activeRuns += runner.activeRunCount;
    maxConcurrency += runner.maxConcurrency;
  }

  const recentTasks = [...jobs]
    .sort((left, right) => right.run.updatedAt.localeCompare(left.run.updatedAt))
    .slice(0, 5);

  return NextResponse.json({
    controlPlane: {
      checkedAt,
      status: stale > 0 || (taskSummary.queued > 0 && online === 0) ? "degraded" : "ready",
      tasks: taskSummary,
      runners: {
        total: runners.length,
        online,
        stale,
        activeRuns,
        maxConcurrency,
        availableCapacity: Math.max(0, maxConcurrency - activeRuns),
      },
      recentTasks,
    },
  });
}
