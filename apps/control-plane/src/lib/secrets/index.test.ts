import { describe, expect, it } from "vitest";

import { readSecretStoreConfig } from "./index";

describe("readSecretStoreConfig", () => {
  it("disables PAT when the KEK is absent and parses a stable 32-byte base64 KEK", () => {
    expect(readSecretStoreConfig({})).toBeUndefined();
    const encoded = Buffer.alloc(32, 4).toString("base64");
    expect(readSecretStoreConfig({ MYSTRA_SECRET_STORE_KEY: encoded })).toMatchObject({
      key: Buffer.alloc(32, 4),
      keyId: "env-v1",
    });
  });

  it("rejects malformed KEKs and key identifiers without echoing either value", () => {
    expect(() => readSecretStoreConfig({ MYSTRA_SECRET_STORE_KEY: "not-a-key" }))
      .toThrow("MYSTRA_SECRET_STORE_KEY must be a base64-encoded 32-byte key");
    expect(() => readSecretStoreConfig({
      MYSTRA_SECRET_STORE_KEY: Buffer.alloc(32, 5).toString("base64"),
      MYSTRA_SECRET_STORE_KEY_ID: "invalid key id",
    })).toThrow("MYSTRA_SECRET_STORE_KEY_ID is invalid");
  });
});
