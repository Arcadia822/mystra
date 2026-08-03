import { describe, expect, it } from "vitest";

import {
  activeSessionStates,
  canTransitionSessionState,
  isActiveSessionState,
  isRunnerOwnedSessionState,
  isTerminalSessionState,
  sessionStateSchema,
  terminalSessionStates,
} from "./state.js";

describe("Session state transitions", () => {
  it("accepts the documented Session states", () => {
    expect(sessionStateSchema.parse("queued")).toBe("queued");
    expect(sessionStateSchema.parse("waiting_for_review")).toBe("waiting_for_review");
    expect(() => sessionStateSchema.parse("needs_human_review")).toThrow();
  });

  it("allows the happy-path lifecycle", () => {
    expect(canTransitionSessionState("queued", "dispatching")).toBe(true);
    expect(canTransitionSessionState("dispatching", "assigned")).toBe(true);
    expect(canTransitionSessionState("assigned", "starting")).toBe(true);
    expect(canTransitionSessionState("starting", "running")).toBe(true);
    expect(canTransitionSessionState("running", "waiting_for_review")).toBe(true);
  });

  it("allows strong cancellation from non-terminal active states", () => {
    expect(canTransitionSessionState("queued", "canceled")).toBe(true);
    expect(canTransitionSessionState("assigned", "canceled")).toBe(true);
    expect(canTransitionSessionState("running", "canceled")).toBe(true);
  });

  it("rejects terminal-state mutation and invalid jumps", () => {
    expect(isTerminalSessionState("waiting_for_review")).toBe(true);
    expect(canTransitionSessionState("waiting_for_review", "running")).toBe(false);
    expect(canTransitionSessionState("failed", "queued")).toBe(false);
    expect(canTransitionSessionState("timed_out", "canceled")).toBe(false);
    expect(canTransitionSessionState("queued", "running")).toBe(false);
    expect(canTransitionSessionState("assigned", "succeeded")).toBe(false);
  });

  it("keeps desired-state and cleanup metadata out of SessionState", () => {
    expect(() => sessionStateSchema.parse("cancellation_requested")).toThrow();
    expect(() => sessionStateSchema.parse("cleanup_in_progress")).toThrow();
    expect(() => sessionStateSchema.parse("stale")).toThrow();
  });
});
describe("Session state predicates", () => {
  it("lists every non-terminal state as active", () => {
    expect(activeSessionStates).toEqual(["queued", "dispatching", "assigned", "starting", "running"]);
    for (const state of activeSessionStates) {
      expect(isActiveSessionState(state)).toBe(true);
    }
  });

  it("treats waiting_for_review as terminal and not Runner-owned", () => {
    expect(terminalSessionStates).toContain("waiting_for_review");
    expect(isTerminalSessionState("waiting_for_review")).toBe(true);
    expect(isActiveSessionState("waiting_for_review")).toBe(false);
    expect(isRunnerOwnedSessionState("waiting_for_review")).toBe(false);
  });

  it("identifies only assigned, starting and running as Runner-owned", () => {
    expect(isRunnerOwnedSessionState("assigned")).toBe(true);
    expect(isRunnerOwnedSessionState("starting")).toBe(true);
    expect(isRunnerOwnedSessionState("running")).toBe(true);
    expect(isRunnerOwnedSessionState("queued")).toBe(false);
    expect(isRunnerOwnedSessionState("dispatching")).toBe(false);
    expect(isRunnerOwnedSessionState("succeeded")).toBe(false);
    expect(isRunnerOwnedSessionState("canceled")).toBe(false);
  });

  it("preserves terminal-state immutability", () => {
    for (const state of terminalSessionStates) {
      expect(isTerminalSessionState(state)).toBe(true);
      expect(canTransitionSessionState(state, "running")).toBe(false);
    }
  });
});
