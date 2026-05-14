import { z } from "zod";

export const runStateSchema = z.enum([
  "queued",
  "dispatching",
  "assigned",
  "starting",
  "running",
  "succeeded",
  "failed",
  "canceled",
  "timed_out",
  "needs_human_review",
]);
export type RunState = z.infer<typeof runStateSchema>;

export const terminalRunStates = [
  "succeeded",
  "failed",
  "canceled",
  "timed_out",
  "needs_human_review",
] as const satisfies readonly RunState[];

const terminalRunStateSet = new Set<RunState>(terminalRunStates);

const allowedRunStateTransitions = {
  queued: ["dispatching", "assigned", "canceled", "timed_out"],
  dispatching: ["assigned", "canceled", "timed_out", "failed"],
  assigned: ["starting", "canceled", "timed_out", "failed"],
  starting: ["running", "canceled", "timed_out", "failed"],
  running: ["succeeded", "failed", "canceled", "timed_out", "needs_human_review"],
  succeeded: [],
  failed: [],
  canceled: [],
  timed_out: [],
  needs_human_review: [],
} as const satisfies Record<RunState, readonly RunState[]>;

export function isTerminalRunState(state: RunState): boolean {
  return terminalRunStateSet.has(state);
}

export function canTransitionRunState(from: RunState, to: RunState): boolean {
  if (from === to) {
    return true;
  }

  const allowedTargets: readonly RunState[] = allowedRunStateTransitions[from];
  return allowedTargets.includes(to);
}

export function assertRunStateTransition(from: RunState, to: RunState): void {
  if (!canTransitionRunState(from, to)) {
    throw new Error(`Invalid run state transition: ${from} -> ${to}`);
  }
}

// --- 003-config-first-runner-durability: State set predicates ---

export const activeRunStates = [
  "queued",
  "dispatching",
  "assigned",
  "starting",
  "running",
] as const satisfies readonly RunState[];

const activeRunStateSet = new Set<RunState>(activeRunStates);

/**
 * Returns true if the run state is an active (non-terminal) state.
 * Cancellation requests, cleanup progress, and stale evaluation are NOT
 * first-class run states; they are represented by events, desired-state
 * metadata, and runner observations on existing active/terminal states.
 */
export function isActiveRunState(state: RunState): boolean {
  return activeRunStateSet.has(state);
}

/**
 * Returns true if a runner session owns this run (assigned, starting, or running).
 * These are the states where cancellation should be recorded as desired-state
 * metadata rather than an immediate terminal transition.
 */
export function isRunnerOwnedRunState(state: RunState): boolean {
  return state === "assigned" || state === "starting" || state === "running";
}
