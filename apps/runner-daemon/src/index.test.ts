import { describe, expect, it } from "vitest";

import { resolveRuntimeType, retryUntilReachable } from "./index.js";

describe("resolveRuntimeType", () => {
  it("requires MYSTRA_PI_PATH and MYSTRA_RUNNER_RUNTIME_TYPE to agree", () => {
    expect(resolveRuntimeType({})).toBe("host");
    expect(resolveRuntimeType({ MYSTRA_RUNNER_RUNTIME_TYPE: "agentos", MYSTRA_PI_PATH: "/opt/agentos/pi-agentos-shim.mjs" }))
      .toBe("agentos");
    // A Pi shim without the agentos type would register as a host Runtime and never probe it.
    expect(() => resolveRuntimeType({ MYSTRA_PI_PATH: "/opt/agentos/pi-agentos-shim.mjs" }))
      .toThrow(/MYSTRA_RUNNER_RUNTIME_TYPE is not agentos/u);
    expect(() => resolveRuntimeType({ MYSTRA_RUNNER_RUNTIME_TYPE: "agentos" }))
      .toThrow(/requires MYSTRA_PI_PATH/u);
  });
});

describe("retryUntilReachable", () => {
  it("retries an unavailable control-plane endpoint without terminating the daemon", async () => {
    const controller = new AbortController();
    let attempts = 0;

    const result = await retryUntilReachable(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("connection refused");
      }
      return "registered";
    }, "registration", 0, controller.signal);

    expect(result).toBe("registered");
    expect(attempts).toBe(2);
  });
});
