import { describe, expect, it } from "vitest";

import {
  canTransitionRunState,
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
