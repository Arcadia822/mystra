import { describe, expect, it } from "vitest";
import { hostRuntimeRegistrationSchema } from "@mystra/shared";

import {
  buildHostRuntimeRegistrationPayload,
  getStableRunnerId,
  type RunnerIdStore,
} from "./registration.js";

function memoryRunnerIdStore(initialValue?: string): RunnerIdStore & { value: string | undefined } {
  return {
    value: initialValue,
    async read() {
      if (this.value === undefined) {
        const error = new Error("missing") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      }
      return this.value;
    },
    async write(_filePath, value) {
      this.value = value;
    },
  };
}

describe("getStableRunnerId", () => {
  it("creates and reuses a UUID persisted by the local store", async () => {
    const store = memoryRunnerIdStore();

    const first = await getStableRunnerId({ store, filePath: "runner-id" });
    const second = await getStableRunnerId({ store, filePath: "runner-id" });

    expect(first).toMatch(/^[0-9a-f-]{36}$/i);
    expect(second).toBe(first);
  });

  it("rejects a corrupt persisted runner ID rather than changing identity", async () => {
    const store = memoryRunnerIdStore("not-a-uuid");

    await expect(getStableRunnerId({ store, filePath: "runner-id" }))
      .rejects.toThrow("not a valid UUID");
  });
});

describe("buildHostRuntimeRegistrationPayload", () => {
  it("builds the host registration payload with discovered capabilities", () => {
    const payload = buildHostRuntimeRegistrationPayload({
      runnerId: "b1de8827-6325-47b3-b391-77b2f397b9e7",
      name: "dev-machine",
      platform: "darwin/arm64",
      providers: [{
        provider: "copilot",
        discovered: true,
        available: true,
        source: "path",
        resolvedPath: "/usr/local/bin/copilot",
        version: "1.0.69",
        unavailableReason: null,
      }],
    });

    expect(hostRuntimeRegistrationSchema.parse(payload)).toEqual(payload);
  });
});
