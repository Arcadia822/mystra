import { terminalSessionStates, type SessionState } from "./session.js";

export { sessionStateSchema, terminalSessionStates, type SessionState } from "./session.js";

const terminalStateSet = new Set<SessionState>(terminalSessionStates);

const allowedSessionStateTransitions = {
  queued: ["dispatched", "closed", "failed"],
  dispatched: ["message_pending", "closed", "failed"],
  message_pending: ["dispatched", "running", "closed", "failed"],
  running: ["ready", "interrupted", "waiting_for_handoff", "closed", "failed"],
  ready: ["message_pending", "closed", "failed"],
  interrupted: ["running", "message_pending", "ready", "waiting_for_handoff", "closed", "failed"],
  waiting_for_handoff: ["ready", "closed", "failed"],
  closed: [],
  failed: [],
} as const satisfies Record<SessionState, readonly SessionState[]>;

export function isTerminalSessionState(state: SessionState): boolean {
  return terminalStateSet.has(state);
}

export function canTransitionSessionState(from: SessionState, to: SessionState): boolean {
  if (from === to) return true;
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
  "dispatched",
  "message_pending",
  "running",
  "interrupted",
  "waiting_for_handoff",
] as const satisfies readonly SessionState[];

const activeStateSet = new Set<SessionState>(activeSessionStates);

export function isActiveSessionState(state: SessionState): boolean {
  return activeStateSet.has(state);
}

export function isRunnerOwnedSessionState(state: SessionState): boolean {
  return ["dispatched", "message_pending", "running", "interrupted"].includes(state);
}
