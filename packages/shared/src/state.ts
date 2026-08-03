import { z } from "zod";

export const sessionStateSchema = z.enum([
  "queued",
  "dispatching",
  "assigned",
  "starting",
  "running",
  "succeeded",
  "failed",
  "canceled",
  "timed_out",
  "waiting_for_review",
]);
export type SessionState = z.infer<typeof sessionStateSchema>;

export const terminalSessionStates = [
  "succeeded",
  "failed",
  "canceled",
  "timed_out",
  "waiting_for_review",
] as const satisfies readonly SessionState[];

const terminalSessionStateSet = new Set<SessionState>(terminalSessionStates);

const allowedSessionStateTransitions = {
  queued: ["dispatching", "assigned", "canceled", "timed_out"],
  dispatching: ["assigned", "canceled", "timed_out", "failed"],
  assigned: ["starting", "canceled", "timed_out", "failed"],
  starting: ["running", "canceled", "timed_out", "failed"],
  running: ["succeeded", "failed", "canceled", "timed_out", "waiting_for_review"],
  succeeded: [],
  failed: [],
  canceled: [],
  timed_out: [],
  waiting_for_review: [],
} as const satisfies Record<SessionState, readonly SessionState[]>;

export function isTerminalSessionState(state: SessionState): boolean {
  return terminalSessionStateSet.has(state);
}

export function canTransitionSessionState(from: SessionState, to: SessionState): boolean {
  if (from === to) {
    return true;
  }

  const allowedTargets: readonly SessionState[] = allowedSessionStateTransitions[from];
  return allowedTargets.includes(to);
}

export function assertSessionStateTransition(from: SessionState, to: SessionState): void {
  if (!canTransitionSessionState(from, to)) {
    throw new Error(`Invalid Session state transition: ${from} -> ${to}`);
  }
}

export const activeSessionStates = [
  "queued",
  "dispatching",
  "assigned",
  "starting",
  "running",
] as const satisfies readonly SessionState[];

const activeSessionStateSet = new Set<SessionState>(activeSessionStates);

export function isActiveSessionState(state: SessionState): boolean {
  return activeSessionStateSet.has(state);
}

export function isRunnerOwnedSessionState(state: SessionState): boolean {
  return state === "assigned" || state === "starting" || state === "running";
}
