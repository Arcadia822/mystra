import { describe, expect, it } from "vitest";

import { retryUntilReachable } from "./index.js";

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
