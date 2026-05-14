import { describe, expect, it } from "vitest";

import {
  activeRunStates,
  canTransitionRunState,
  isActiveRunState,
  isRunnerOwnedRunState,
  isTerminalRunState,
  runStateSchema,
} from "./state.js";

describe("run state transitions", () => {
  it("accepts the documented run states", () => {
    expect(runStateSchema.parse("queued")).toBe("queued");
    expect(runStateSchema.parse("needs_human_review")).toBe("needs_human_review");
  });

  it("allows the happy-path lifecycle", () => {
    expect(canTransitionRunState("queued", "dispatching")).toBe(true);
    expect(canTransitionRunState("dispatching", "assigned")).toBe(true);
    expect(canTransitionRunState("assigned", "starting")).toBe(true);
    expect(canTransitionRunState("starting", "running")).toBe(true);
    expect(canTransitionRunState("running", "succeeded")).toBe(true);
  });

  it("allows strong cancellation from non-terminal active states", () => {
    expect(canTransitionRunState("queued", "canceled")).toBe(true);
    expect(canTransitionRunState("assigned", "canceled")).toBe(true);
    expect(canTransitionRunState("running", "canceled")).toBe(true);
  });

  it("rejects terminal-state mutation", () => {
    expect(isTerminalRunState("succeeded")).toBe(true);
    expect(canTransitionRunState("succeeded", "running")).toBe(false);
    expect(canTransitionRunState("failed", "queued")).toBe(false);
    expect(canTransitionRunState("timed_out", "canceled")).toBe(false);
  });

  it("rejects invalid lifecycle jumps", () => {
    expect(canTransitionRunState("queued", "running")).toBe(false);
    expect(canTransitionRunState("assigned", "succeeded")).toBe(false);
  });
});

// --- 003-config-first-runner-durability: State representation rule tests ---

describe("state representation rule", () => {
  it("does not add cancellation_requested as a RunState value", () => {
    expect(() => runStateSchema.parse("cancellation_requested")).toThrow();
  });

  it("does not add cleanup_in_progress as a RunState value", () => {
    expect(() => runStateSchema.parse("cleanup_in_progress")).toThrow();
  });

  it("does not add stale as a RunState value", () => {
    expect(() => runStateSchema.parse("stale")).toThrow();
  });
});

describe("activeRunStates", () => {
  it("lists all non-terminal states", () => {
    expect(activeRunStates).toEqual(["queued", "dispatching", "assigned", "starting", "running"]);
  });
});

describe("isActiveRunState", () => {
  it("returns true for active states", () => {
    expect(isActiveRunState("queued")).toBe(true);
    expect(isActiveRunState("assigned")).toBe(true);
    expect(isActiveRunState("running")).toBe(true);
  });

  it("returns false for terminal states", () => {
    expect(isActiveRunState("succeeded")).toBe(false);
    expect(isActiveRunState("failed")).toBe(false);
    expect(isActiveRunState("canceled")).toBe(false);
    expect(isActiveRunState("timed_out")).toBe(false);
  });
});

describe("isRunnerOwnedRunState", () => {
  it("returns true for states where a runner owns the work", () => {
    expect(isRunnerOwnedRunState("assigned")).toBe(true);
    expect(isRunnerOwnedRunState("starting")).toBe(true);
    expect(isRunnerOwnedRunState("running")).toBe(true);
  });

  it("returns false for queued and terminal states", () => {
    expect(isRunnerOwnedRunState("queued")).toBe(false);
    expect(isRunnerOwnedRunState("dispatching")).toBe(false);
    expect(isRunnerOwnedRunState("succeeded")).toBe(false);
    expect(isRunnerOwnedRunState("canceled")).toBe(false);
  });
});

describe("terminal-state immutability", () => {
  it("preserves timeout as a terminal state that cannot be overwritten", () => {
    expect(isTerminalRunState("timed_out")).toBe(true);
    expect(canTransitionRunState("timed_out", "running")).toBe(false);
    expect(canTransitionRunState("timed_out", "canceled")).toBe(false);
  });

  it("preserves canceled as a terminal state that cannot be overwritten", () => {
    expect(isTerminalRunState("canceled")).toBe(true);
    expect(canTransitionRunState("canceled", "running")).toBe(false);
  });

  it("preserves failed as a terminal state that cannot be overwritten", () => {
    expect(isTerminalRunState("failed")).toBe(true);
    expect(canTransitionRunState("failed", "queued")).toBe(false);
  });
});
