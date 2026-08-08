import { describe, expect, it } from "vitest";

import type { RdbProvider, SecretEnvelopeRecord, SecretEnvelopeWrite } from "../db/rdb-provider";
import { RdbSecretProvider } from "./rdb-secret-provider";

const ref = "github-pat/00000000-0000-4000-8000-000000000041/00000000-0000-4000-8000-000000000042";

class MemoryEnvelopeStore {
  readonly values = new Map<string, SecretEnvelopeRecord>();

  async createSecretEnvelope(input: SecretEnvelopeWrite): Promise<void> {
    if (this.values.has(input.reference)) throw new Error("duplicate");
    this.values.set(input.reference, { ...input, createdAt: "2026-08-06T00:00:00.000Z" });
  }

  async getSecretEnvelope(reference: string): Promise<SecretEnvelopeRecord | undefined> {
    return this.values.get(reference);
  }

  async deleteSecretEnvelope(reference: string): Promise<void> {
    this.values.delete(reference);
  }
}

function provider(store: MemoryEnvelopeStore, keyByte = 1): RdbSecretProvider {
  return new RdbSecretProvider({
    db: store as unknown as RdbProvider,
    key: Buffer.alloc(32, keyByte),
    keyId: "test-v1",
  });
}

describe("RdbSecretProvider", () => {
  it("round-trips through an envelope without persisting plaintext or the KEK", async () => {
    const store = new MemoryEnvelopeStore();
    const secrets = provider(store);

    await secrets.put(ref, "github_pat_fixture_secret");

    expect(await secrets.get(ref)).toBe("github_pat_fixture_secret");
    const persisted = store.values.get(ref)!;
    expect(JSON.stringify(persisted)).not.toContain("github_pat_fixture_secret");
    expect(JSON.stringify(persisted)).not.toContain(Buffer.alloc(32, 1).toString("base64"));
    expect(persisted).toMatchObject({
      reference: ref,
      version: 1,
      algorithm: "aes-256-gcm+aes-256-gcm-wrap",
      keyId: "test-v1",
    });
  });

  it("uses a fresh DEK and IVs for every immutable credential version", () => {
    const store = new MemoryEnvelopeStore();
    const secrets = provider(store);
    const left = secrets.seal(ref, "same-plaintext");
    const right = secrets.seal(
      "github-pat/00000000-0000-4000-8000-000000000041/00000000-0000-4000-8000-000000000043",
      "same-plaintext",
    );

    expect(left.ciphertext).not.toBe(right.ciphertext);
    expect(left.ciphertextIv).not.toBe(right.ciphertextIv);
    expect(left.wrappedDataKey).not.toBe(right.wrappedDataKey);
    expect(left.wrappedDataKeyIv).not.toBe(right.wrappedDataKeyIv);
  });

  it("accepts only the explicit GitHub PAT and Linear API-key namespaces", () => {
    const secrets = provider(new MemoryEnvelopeStore());
    expect(() => secrets.seal(
      "linear-api-key/00000000-0000-4000-8000-000000000041/00000000-0000-4000-8000-000000000042",
      "linear-secret",
    )).not.toThrow();
    expect(() => secrets.seal(
      "arbitrary/00000000-0000-4000-8000-000000000041/00000000-0000-4000-8000-000000000042",
      "secret",
    )).toThrow("Invalid secret reference");
  });

  it("fails closed for a wrong KEK, tampering, a missing row, or an invalid reference", async () => {
    const store = new MemoryEnvelopeStore();
    const secrets = provider(store, 2);
    await secrets.put(ref, "github_pat_integrity");

    await expect(provider(store, 3).get(ref)).rejects.toThrow("Secret could not be decrypted");
    store.values.get(ref)!.ciphertextAuthTag = Buffer.alloc(16, 9).toString("base64");
    await expect(secrets.get(ref)).rejects.toThrow("Secret could not be decrypted");
    await expect(secrets.get(
      "github-pat/00000000-0000-4000-8000-000000000041/00000000-0000-4000-8000-000000000099",
    )).rejects.toThrow("Secret is unavailable");
    expect(() => secrets.seal("../escape", "secret")).toThrow("Invalid secret reference");
  });

  it("deletes only the addressed envelope and treats an absent row as deleted", async () => {
    const store = new MemoryEnvelopeStore();
    const secrets = provider(store);
    await secrets.put(ref, "github_pat_delete");

    await secrets.delete(ref);
    await expect(secrets.get(ref)).rejects.toThrow("Secret is unavailable");
    await expect(secrets.delete(ref)).resolves.toBeUndefined();
  });
});
