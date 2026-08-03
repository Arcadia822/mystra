import { describe, expect, it } from "vitest";
import { runnerRegistrationSchema } from "@mystra/shared";

import { buildRunnerRegistrationPayload } from "./registration.js";

describe("buildRunnerRegistrationPayload", () => {
  it("supplies a valid default agent for fake executor registration", () => {
    const payload = buildRunnerRegistrationPayload({
      runnerName: "fake-runner",
      executor: "fake",
      concurrency: 1,
      staleAfterSeconds: 90,
    });

    expect(() => runnerRegistrationSchema.parse(payload)).not.toThrow();
    expect(payload.capabilities.agents).toEqual(["codex"]);
    expect(payload.capabilities.executor).toBe("fake");
    expect(payload.capabilities.providers).toEqual(["docker"]);
    expect(payload.capabilities.contextBundleModes).toEqual([]);
  });

  it("preserves registered docker agents for docker executor registration", () => {
    const payload = buildRunnerRegistrationPayload({
      runnerName: "docker-runner",
      executor: "docker",
      concurrency: 2,
      staleAfterSeconds: 45,
      eligibleRuntimeProviders: ["docker"],
    }, ["codex", "copilot"]);

    expect(() => runnerRegistrationSchema.parse(payload)).not.toThrow();
    expect(payload.capabilities.agents).toEqual(["codex", "copilot"]);
    expect(payload.capabilities.providers).toEqual(["docker"]);
  });
});
