export const sessionBusinessStates = ["INIT", "RUNNING", "INTERRUPTED", "DONE"] as const;

export type SessionBusinessState = (typeof sessionBusinessStates)[number];

export const sessionBusinessStateTransitions = {
  INIT: ["RUNNING", "INTERRUPTED", "DONE"],
  RUNNING: ["INTERRUPTED", "DONE"],
  INTERRUPTED: ["RUNNING", "DONE"],
  DONE: ["RUNNING", "INTERRUPTED"],
} as const satisfies Record<SessionBusinessState, readonly SessionBusinessState[]>;

export const internalSessionExecutionFacts = ["queued", "dispatched", "message_pending"] as const;

export function canTransitionSessionBusinessState(
  from: SessionBusinessState,
  to: SessionBusinessState,
): boolean {
  const targets: readonly SessionBusinessState[] = sessionBusinessStateTransitions[from];
  return targets.includes(to);
}

