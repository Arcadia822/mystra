import { describe, expect, it } from "vitest";

import { initialControlPlaneGateState } from "./control-plane-gate-model";

describe("initialControlPlaneGateState", () => {
  it("renders public authentication routes without waiting for client session hydration", () => {
    expect(initialControlPlaneGateState(true)).toBe("unauthenticated");
  });

  it("keeps protected routes behind the session loading gate", () => {
    expect(initialControlPlaneGateState(false)).toBe("loading");
  });
});
