import { describe, expect, it } from "vitest";

import {
  canTransitionSessionBusinessState,
  internalSessionExecutionFacts,
  sessionBusinessStates,
  sessionBusinessStateTransitions,
  type SessionBusinessState,
} from "./session-business-state-model";

describe("055 Session business state prototype model", () => {
  it("uses exactly the four owner-approved product states", () => {
    expect(sessionBusinessStates).toEqual(["INIT", "RUNNING", "INTERRUPTED", "DONE"]);
    expect(internalSessionExecutionFacts).toEqual(["queued", "dispatched", "message_pending"]);
  });

  it("lets INIT leave once for any non-INIT state", () => {
    expect(sessionBusinessStateTransitions.INIT).toEqual(["RUNNING", "INTERRUPTED", "DONE"]);
    for (const state of sessionBusinessStates.filter((candidate) => candidate !== "INIT")) {
      expect(canTransitionSessionBusinessState(state, "INIT")).toBe(false);
    }
  });

  it("allows every pair among RUNNING, INTERRUPTED and DONE", () => {
    const recurringStates: readonly SessionBusinessState[] = ["RUNNING", "INTERRUPTED", "DONE"];
    for (const from of recurringStates) {
      for (const to of recurringStates) {
        if (from === to) continue;
        expect(canTransitionSessionBusinessState(from, to)).toBe(true);
      }
    }
  });
});

