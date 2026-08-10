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
  it("uses the 049 multi-message lifecycle", () => {
    for (const state of [
      "queued", "dispatched", "message_pending", "running", "ready",
      "interrupted", "waiting_for_handoff", "closed", "failed",
    ]) {
      expect(sessionStateSchema.parse(state)).toBe(state);
    }
    for (const obsolete of ["dispatching", "assigned", "starting", "succeeded", "canceled", "timed_out", "waiting_for_review"]) {
      expect(() => sessionStateSchema.parse(obsolete)).toThrow();
    }
  });

  it("allows launch, response release, continuation and close", () => {
    expect(canTransitionSessionState("queued", "dispatched")).toBe(true);
    expect(canTransitionSessionState("dispatched", "message_pending")).toBe(true);
    expect(canTransitionSessionState("message_pending", "running")).toBe(true);
    expect(canTransitionSessionState("running", "ready")).toBe(true);
    expect(canTransitionSessionState("ready", "message_pending")).toBe(true);
    expect(canTransitionSessionState("ready", "closed")).toBe(true);
  });

  it("keeps only closed and failed terminal", () => {
    expect(terminalSessionStates).toEqual(["closed", "failed"]);
    expect(isTerminalSessionState("closed")).toBe(true);
    expect(isTerminalSessionState("failed")).toBe(true);
    expect(isTerminalSessionState("ready")).toBe(false);
    expect(canTransitionSessionState("closed", "running")).toBe(false);
  });
});

describe("Session state ownership", () => {
  it("does not treat ready as active or Runtime-owned", () => {
    expect(activeSessionStates).toEqual([
      "queued", "dispatched", "message_pending", "running", "interrupted", "waiting_for_handoff",
    ]);
    expect(isActiveSessionState("ready")).toBe(false);
    expect(isRunnerOwnedSessionState("ready")).toBe(false);
  });

  it("limits Runtime ownership to dispatched executions", () => {
    for (const state of ["dispatched", "message_pending", "running", "interrupted"] as const) {
      expect(isRunnerOwnedSessionState(state)).toBe(true);
    }
    expect(isRunnerOwnedSessionState("queued")).toBe(false);
    expect(isRunnerOwnedSessionState("waiting_for_handoff")).toBe(false);
  });
});
