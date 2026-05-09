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
